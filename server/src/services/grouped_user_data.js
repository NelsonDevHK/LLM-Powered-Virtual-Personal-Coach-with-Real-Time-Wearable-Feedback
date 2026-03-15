import userRepository from '../database/repositories/user_repository.js';
import wearableRepository from '../database/repositories/wearable_repository.js';

function getAgeGroup(age) {
  if (age >= 13 && age <= 19) return 'Teen';
  if (age >= 20 && age <= 34) return 'Young adult';
  if (age >= 35 && age <= 59) return 'Mid adult';
  if (age >= 60) return 'Older adult';
  return 'Unknown';
}

/**
 * Fetches grouped user profile and wearable data for RAG context
 * @param {number} userId
 * @returns {Promise<Object>} grouped data
 */
export async function getGroupedUserData(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new Error('User not found');


  // Use age field directly
  const age = user.age ? parseInt(user.age, 10) : null;
  const age_group = age ? getAgeGroup(age) : 'Unknown';

  const wearable_data = await wearableRepository.findById(userId);

  return {
    user_id: user.user_id,
    gender: user.gender,
    age_group,
    exercise_level: user.exercise_level,
    wearable_data,
  };
}
