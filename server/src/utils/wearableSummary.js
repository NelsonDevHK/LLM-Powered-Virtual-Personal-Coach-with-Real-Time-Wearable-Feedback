// utils/wearableSummary.js

/**
 * Summarizes an array of wearable data records (heart_rate, current_speed)
 * @param {Array} wearableArr
 * @returns {string} summary string
 */
export function summarizeWearableData(wearableArr) {
  if (!Array.isArray(wearableArr) || wearableArr.length === 0) return '';
  const hrArr = wearableArr.map(w => Number(w.heart_rate)).filter(n => !isNaN(n));
  const spArr = wearableArr.map(w => Number(w.current_speed)).filter(n => !isNaN(n));
  if (hrArr.length === 0 && spArr.length === 0) return '';
  let summary = '';
  if (hrArr.length > 0) {
    const minHR = Math.min(...hrArr);
    const maxHR = Math.max(...hrArr);
    const avgHR = (hrArr.reduce((a, b) => a + b, 0) / hrArr.length).toFixed(1);
    summary += `Heart rate (min/avg/max): ${minHR}/${avgHR}/${maxHR} bpm`;
  }
  if (spArr.length > 0) {
    if (summary) summary += ', ';
    const minSP = Math.min(...spArr);
    const maxSP = Math.max(...spArr);
    const avgSP = (spArr.reduce((a, b) => a + b, 0) / spArr.length).toFixed(2);
    summary += `Speed (min/avg/max): ${minSP}/${avgSP}/${maxSP} km/h`;
  }
  return summary;
}
