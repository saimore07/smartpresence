/**
 * SmartPresence - Face Recognition Engine Integration Service
 * 
 * Client-side utilities and threshold metadata corresponding to the
 * OpenCV YuNet + SFace backend microservice pipeline.
 */

export const RECOGNITION_THRESHOLDS = {
  ACCEPTANCE_THRESHOLD: 0.45, // >= 0.45: Match confirmed
  REJECTION_THRESHOLD: 0.34,  // 0.34 - 0.45: Uncertain / Manual Review
};

export const MATCH_OUTCOMES = {
  MATCHED: 'MATCHED',
  UNCERTAIN: 'UNCERTAIN',
  UNKNOWN: 'UNKNOWN',
  LOW_QUALITY: 'LOW_QUALITY',
};

/**
 * Returns user-friendly status badge details for a match confidence score.
 */
export const getConfidenceBadge = (confidence) => {
  const percentage = Math.round((confidence || 0) * 100);
  if (confidence >= RECOGNITION_THRESHOLDS.ACCEPTANCE_THRESHOLD) {
    return {
      label: `${percentage}% Match`,
      color: '#137333',
      bgColor: '#e6f4ea',
      isHighConfidence: true,
    };
  }
  if (confidence >= RECOGNITION_THRESHOLDS.REJECTION_THRESHOLD) {
    return {
      label: `${percentage}% Uncertain`,
      color: '#b06000',
      bgColor: '#fef7e0',
      isHighConfidence: false,
    };
  }
  return {
    label: 'Unmatched',
    color: '#c5221f',
    bgColor: '#fce8e6',
    isHighConfidence: false,
  };
};

export default {
  RECOGNITION_THRESHOLDS,
  MATCH_OUTCOMES,
  getConfidenceBadge,
};
