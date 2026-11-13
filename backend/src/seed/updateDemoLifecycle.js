require('dotenv').config();

const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const Work = require('../models/Work');
const { getWorkStatusTransitionError } = require('../domain/workLifecycle');

const DEMO_NAME_PATTERN = /^DEMO-IND-\d{5}\s+-/i;
const TARGETS = { Proposed: 2500, Approved: 2000, Started: 3000, Completed: 2500 };
const APPLY = process.argv.includes('--apply');

function countMap(rows) {
  return Object.fromEntries(rows.map(({ _id, count }) => [_id, count]));
}

async function getCounts(filter) {
  const rows = await Work.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return countMap(rows);
}

async function advance(work, nextStatus) {
  const error = getWorkStatusTransitionError(work.status, nextStatus);
  if (error) throw new Error(`${work.name}: ${error}`);

  const now = new Date();
  if (nextStatus === 'Started') {
    work.plannedProgress = Math.max(work.plannedProgress || 0, 65);
    work.actualProgress = Math.max(work.actualProgress || 0, 40);
    work.actualStartDate = work.actualStartDate || new Date(now.getTime() - 45 * 86400000);
    work.expenditure = Math.max(work.expenditure || 0, 85000);
  }
  if (nextStatus === 'Completed') {
    work.plannedProgress = 100;
    work.actualProgress = 100;
    work.actualStartDate = work.actualStartDate || new Date(now.getTime() - 180 * 86400000);
    work.actualEndDate = work.actualEndDate || new Date(now.getTime() - 30 * 86400000);
    work.expenditure = Math.max(work.expenditure || 0, 180000);
  }
  work.status = nextStatus;
  await work.save();
}

async function main() {
  await connectDatabase();
  const filter = { name: { $regex: DEMO_NAME_PATTERN } };
  const total = await Work.countDocuments(filter);
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Matching DEMO-IND records: ${total}`);
  if (total !== 10000) {
    throw new Error(`Expected exactly 10,000 DEMO-IND records; found ${total}. No records were changed.`);
  }

  let counts = await getCounts(filter);
  console.log('Current status counts:', JSON.stringify(counts));
  const knownTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (knownTotal !== 10000) throw new Error('Status counts do not add up to 10,000. No records were changed.');

  for (const [status, target] of Object.entries(TARGETS)) {
    if ((counts[status] || 0) > target) {
      // An over-target intermediate stage can occur if the previous run stopped
      // between individual status saves. It is safe to promote it forward.
      if (status === 'Completed') {
        throw new Error(`${status} count exceeds its target. Manual review required; no records were changed.`);
      }
    }
  }

  if (!APPLY) {
    console.log('Target status counts:', JSON.stringify(TARGETS));
    console.log('DRY RUN ONLY. No records were changed.');
    console.log('If these are the intended demo records, run: npm run update-demo-lifecycle -- --apply');
    return;
  }

  let processed = 0;
  while (true) {
    counts = await getCounts(filter);
    const completedDeficit = TARGETS.Completed - (counts.Completed || 0);
    if (completedDeficit <= 0) break;

    // Choose a donor stage that is above its target, preferring Proposed.
    let donorStatus = null;
    for (const candidate of ['Proposed', 'Approved', 'Started']) {
      if ((counts[candidate] || 0) > TARGETS[candidate]) {
        donorStatus = candidate;
        break;
      }
    }
    if (!donorStatus) {
      throw new Error(`Cannot safely reach target distribution. Current counts: ${JSON.stringify(counts)}. No further record was selected.`);
    }

    const work = await Work.findOne({ ...filter, status: donorStatus }).sort({ name: 1, _id: 1 });
    if (!work) throw new Error(`Could not find a ${donorStatus} demo record despite its count.`);

    const nextStatus = donorStatus === 'Proposed' ? 'Approved' : donorStatus === 'Approved' ? 'Started' : 'Completed';
    await advance(work, nextStatus);
    processed += 1;
    if (processed % 100 === 0) {
      const liveCounts = await getCounts(filter);
      console.log(`Promoted ${processed} records this run. Current counts: ${JSON.stringify(liveCounts)}`);
    }
  }

  const finalCounts = await getCounts(filter);
  console.log('Final status counts:', JSON.stringify(finalCounts));
  const mismatches = Object.entries(TARGETS).filter(([status, target]) => (finalCounts[status] || 0) !== target);
  if (mismatches.length) {
    throw new Error('Update stopped before reaching all target counts. Re-run the same command to resume safely.');
  }
  console.log('Demo lifecycle update completed successfully. Non-DEMO-IND records were not selected.');
}

main()
  .catch((error) => {
    console.error(`Demo lifecycle update failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

