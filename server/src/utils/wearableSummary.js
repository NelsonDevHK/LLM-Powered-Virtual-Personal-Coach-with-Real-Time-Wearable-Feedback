// utils/wearableSummary.js

/**
 * Summarizes an array of wearable data records (heart_rate and recovery metrics)
 * @param {Array} wearableArr
 * @returns {string} summary string
 */
export function summarizeWearableData(wearableArr) {
  if (!Array.isArray(wearableArr) || wearableArr.length === 0) return '';
  const hrArr = wearableArr.map(w => Number(w.heart_rate)).filter(n => !isNaN(n));
  const sleepDurationArr = wearableArr.map(w => Number(w.sleep_duration)).filter(n => !isNaN(n));
  const sleepQualityArr = wearableArr.map(w => Number(w.sleep_quality)).filter(n => !isNaN(n));
  const setCountArr = wearableArr.map(w => Number(w.set_count)).filter(n => !isNaN(n));
  const restDurationArr = wearableArr.map(w => Number(w.rest_duration)).filter(n => !isNaN(n));
  if (
    hrArr.length === 0
    && sleepDurationArr.length === 0
    && sleepQualityArr.length === 0
    && setCountArr.length === 0
    && restDurationArr.length === 0
  ) {
    return '';
  }
  let summary = '';
  if (hrArr.length > 0) {
    const minHR = Math.min(...hrArr);
    const maxHR = Math.max(...hrArr);
    const avgHR = (hrArr.reduce((a, b) => a + b, 0) / hrArr.length).toFixed(1);
    summary += `Heart rate (min/avg/max): ${minHR}/${avgHR}/${maxHR} bpm`;
  }
  if (sleepDurationArr.length > 0) {
    if (summary) summary += ', ';
    const avgSleepMin = (sleepDurationArr.reduce((a, b) => a + b, 0) / sleepDurationArr.length).toFixed(0);
    summary += `Sleep duration avg: ${avgSleepMin} min`;
  }
  if (sleepQualityArr.length > 0) {
    if (summary) summary += ', ';
    const avgSleepQuality = (sleepQualityArr.reduce((a, b) => a + b, 0) / sleepQualityArr.length).toFixed(1);
    summary += `Sleep quality avg: ${avgSleepQuality}/5`;
  }
  if (setCountArr.length > 0) {
    if (summary) summary += ', ';
    const avgSetCount = (setCountArr.reduce((a, b) => a + b, 0) / setCountArr.length).toFixed(1);
    summary += `Set count avg: ${avgSetCount}`;
  }
  if (restDurationArr.length > 0) {
    if (summary) summary += ', ';
    const avgRestMin = (restDurationArr.reduce((a, b) => a + b, 0) / restDurationArr.length).toFixed(1);
    summary += `Rest duration avg: ${avgRestMin} min`;
  }
  return summary;
}
