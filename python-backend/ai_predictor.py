"""
AI Focus Predictor Module (Hybrid: Rule-Based + GWO-PSO ANN)

Combines heuristic rules with the trained ANN model to make real-time
cognitive focus predictions from F1 telemetry data.

PREDICTION FLOW:
1. Rule-Based Check (Heuristics):
   - If Speed == 0 → Out of Focus (0) immediately
   - If Throttle == 0 AND Brake == 0 AND Steering_Angle == 0 → Out of Focus (0)
2. If rules pass (car is moving & being controlled):
   - Scale data using scaler_telemetri.pkl
   - Predict using model_kognitif_gwo_pso_ann.h5

Input features (8 features as trained):
1. Speed (km/h)
2. Steering_Angle (raw value from game, approx -1..1)
3. Throttle (0.0 - 1.0)
4. Brake (0.0 - 1.0)
5. Steering_Diff (change from previous point)
6. Brake_Diff (change from previous point)
7. Throttle_Diff (change from previous point)
8. Lap_Time_Second (seconds)

Output:
- Focus classification: 1 (Focused) or 0 (Distracted/Out of Focus)
- Confidence score: 0.0 - 1.0
"""

import os
import numpy as np
import joblib
from collections import deque

# Paths to model files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, 'ai_model', 'model_kognitif_gwo_pso_ann.h5')
SCALER_PATH = os.path.join(BASE_DIR, 'ai_model', 'scaler_telemetri.pkl')

# Global model and scaler instances
_model = None
_scaler = None

# Store previous data point for computing diffs
_prev_point = {
    'steeringAngle': 0.0,
    'brake': 0.0,
    'throttle': 0.0,
}

# ============================================================
# SLIDING WINDOW for BatchNorm fix
# The model uses BatchNormalization which requires batch_size > 1
# to produce meaningful outputs with training=True.
# We maintain a window of recent feature vectors and always predict
# as a batch. The LAST element is the current prediction.
# ============================================================
WINDOW_SIZE = 16  # Number of recent samples to keep for batch prediction
_feature_window = deque(maxlen=WINDOW_SIZE)

# ============================================================
# FOCUS SCORE SMOOTHING (Exponential Moving Average)
# alpha=0.35 → responsive (converges in ~4 samples) but stable
# ============================================================
SMOOTHING_ALPHA = 0.35
_smoothed_focus_score = 100.0  # Start at 100% (fresh lap)
_current_lap_num = 0


def load_model():
    """Load the ANN model and scaler. Called once on startup."""
    global _model, _scaler

    # Load scaler
    if os.path.exists(SCALER_PATH):
        _scaler = joblib.load(SCALER_PATH)
        print(f"[AI] ✓ Scaler loaded: {SCALER_PATH}")
        print(f"[AI]   Features: {list(_scaler.feature_names_in_)}")
    else:
        print(f"[AI] ✗ Scaler not found: {SCALER_PATH}")
        return False

    # Load ANN model
    if os.path.exists(MODEL_PATH):
        try:
            from tensorflow.keras.models import load_model as keras_load
            _model = keras_load(MODEL_PATH)
            print(f"[AI] ✓ ANN Model loaded: {MODEL_PATH}")
            print(f"[AI]   Input shape: {_model.input_shape}")
            print(f"[AI]   Output shape: {_model.output_shape}")
            return True
        except Exception as e:
            print(f"[AI] ✗ Error loading model: {e}")
            return False
    else:
        print(f"[AI] ✗ Model not found: {MODEL_PATH}")
        return False


# =============================================================================
# RULE-BASED LOGIC (HEURISTICS)
# =============================================================================

def _check_rules(speed, steering_angle, throttle, brake):
    """
    Apply rule-based heuristics BEFORE the AI model.
    
    Rules:
      1. Speed == 0 → Out of Focus (car not moving)
      2. Throttle == 0 AND Brake == 0 AND Steering == 0 → Out of Focus (no input/AFK)
    
    Returns:
        tuple: (rule_triggered: bool, result: dict or None)
        - If rule_triggered is True, result contains the classification.
        - If rule_triggered is False, result is None (proceed to AI model).
    """
    # Rule 1: Car is stationary
    if speed == 0:
        return True, {
            'focusScore': 0.0,
            'isFocused': False,
            'confidence': 1.0,
            'method': 'rule-based',
            'rule': 'speed_zero',
            'reason': 'Car is stationary (Speed = 0)',
        }

    # Rule 2: No driver input at all (AFK / idle hands)
    if throttle == 0 and brake == 0 and steering_angle == 0:
        return True, {
            'focusScore': 0.0,
            'isFocused': False,
            'confidence': 1.0,
            'method': 'rule-based',
            'rule': 'no_input',
            'reason': 'No driver input (Throttle=0, Brake=0, Steering=0)',
        }

    # All rules passed — proceed to AI model
    return False, None


# =============================================================================
# FEATURE ENGINEERING
# =============================================================================

def _build_feature_vector(point, prev):
    """
    Build the 8-feature vector expected by the model.
    
    Features: Speed, Steering_Angle, Throttle, Brake, 
              Steering_Diff, Brake_Diff, Throttle_Diff, Lap_Time_Second
    """
    speed = point.get('speed', 0)
    steering = point.get('steeringAngle', 0)
    throttle = point.get('throttle', 0)
    brake = point.get('brake', 0)
    lap_time = point.get('lapTime', 0)

    # Compute diffs from previous point
    steering_diff = steering - prev.get('steeringAngle', steering)
    brake_diff = brake - prev.get('brake', brake)
    throttle_diff = throttle - prev.get('throttle', throttle)

    return [speed, steering, throttle, brake, steering_diff, brake_diff, throttle_diff, lap_time]


# =============================================================================
# BATCH PREDICTION (Multiple data points)
# =============================================================================

def predict_focus(telemetry_data):
    """
    Predict focus level from a batch of telemetry data points.
    Applies rule-based logic first, then AI model for remaining points.

    Args:
        telemetry_data: list of dicts with keys:
            [speed, steeringAngle, throttle, brake, lapTime, lapDistance]

    Returns:
        dict with focusLevel, confidenceScore, averageFocusPct, etc.
    """
    global _model, _scaler

    if _model is None or _scaler is None:
        return {
            'error': 'Model not loaded',
            'focusLevel': 'Unknown',
            'confidenceScore': 0,
            'averageFocusPct': 0,
        }

    if not telemetry_data or len(telemetry_data) == 0:
        return {
            'error': 'No data provided',
            'focusLevel': 'Unknown',
            'confidenceScore': 0,
            'averageFocusPct': 0,
        }

    # Separate points: rule-based vs AI-needed
    rule_scores = []       # Scores from rule-based (always 0.0 for out-of-focus)
    ai_features = []       # Feature vectors that need AI prediction
    ai_indices = []        # Track which indices go to AI

    for i, point in enumerate(telemetry_data):
        speed = point.get('speed', 0)
        steering = point.get('steeringAngle', 0)
        throttle = point.get('throttle', 0)
        brake = point.get('brake', 0)

        rule_triggered, rule_result = _check_rules(speed, steering, throttle, brake)

        if rule_triggered:
            rule_scores.append((i, 0.0))  # Out of Focus
        else:
            # Build feature vector for AI
            prev = telemetry_data[i - 1] if i > 0 else point
            feature_vector = _build_feature_vector(point, prev)
            ai_features.append(feature_vector)
            ai_indices.append(i)

    # Run AI model on points that passed rules
    ai_scores = {}
    if ai_features:
        X = np.array(ai_features)
        try:
            import pandas as pd
            feature_names = ['Speed', 'Steering_Angle', 'Throttle', 'Brake', 'Steering_Diff', 'Brake_Diff', 'Throttle_Diff', 'Lap_Time_Second']
            X_df = pd.DataFrame(X, columns=feature_names)
            X_scaled = _scaler.transform(X_df)
        except Exception as e:
            print(f"[AI] Scaler error: {e}")
            return {
                'error': f'Scaler error: {str(e)}',
                'focusLevel': 'Unknown',
                'confidenceScore': 0,
                'averageFocusPct': 0,
            }

        try:
            import tensorflow as tf
            X_tensor = tf.constant(X_scaled, dtype=tf.float32)
            predictions_raw = _model(X_tensor, training=False).numpy()

            if predictions_raw.shape[-1] == 1:
                ai_confidence = predictions_raw.flatten()
            elif predictions_raw.shape[-1] == 2:
                ai_confidence = predictions_raw[:, 1]
            else:
                ai_confidence = np.max(predictions_raw, axis=1)

            for idx, conf in zip(ai_indices, ai_confidence):
                ai_scores[idx] = float(conf)

        except Exception as e:
            print(f"[AI] Prediction error: {e}")
            return {
                'error': f'Prediction error: {str(e)}',
                'focusLevel': 'Unknown',
                'confidenceScore': 0,
                'averageFocusPct': 0,
            }

    # Combine all scores in original order
    all_scores = np.zeros(len(telemetry_data))
    for idx, score in rule_scores:
        all_scores[idx] = score
    for idx, score in ai_scores.items():
        all_scores[idx] = score

    # Compute summary statistics
    predictions = (all_scores > 0.5).astype(int)
    focus_pct = float(np.mean(all_scores) * 100)
    avg_confidence = float(np.mean(all_scores))
    min_focus = float(np.min(all_scores) * 100)
    max_focus = float(np.max(all_scores) * 100)

    if focus_pct >= 80:
        focus_level = "High Focus"
    elif focus_pct >= 50:
        focus_level = "Medium Focus"
    else:
        focus_level = "Low Focus"

    return {
        'focusLevel': focus_level,
        'confidenceScore': round(avg_confidence, 4),
        'averageFocusPct': round(focus_pct, 1),
        'minFocusPct': round(min_focus, 1),
        'maxFocusPct': round(max_focus, 1),
        'totalDataPoints': len(telemetry_data),
        'focusedCount': int(np.sum(predictions == 1)),
        'distractedCount': int(np.sum(predictions == 0)),
        'ruleBasedCount': len(rule_scores),
        'aiPredictedCount': len(ai_features),
    }


# =============================================================================
# SINGLE-POINT PREDICTION (Real-time)
# =============================================================================

def _apply_smoothing(raw_score):
    """Apply EMA smoothing. alpha=0.35 converges in ~4 samples."""
    global _smoothed_focus_score
    _smoothed_focus_score = (SMOOTHING_ALPHA * raw_score) + ((1 - SMOOTHING_ALPHA) * _smoothed_focus_score)
    return _smoothed_focus_score


def reset_focus_for_new_lap(new_lap_num):
    """Reset focus to 100% when a new lap starts."""
    global _smoothed_focus_score, _current_lap_num, _feature_window
    if new_lap_num > _current_lap_num:
        _current_lap_num = new_lap_num
        _smoothed_focus_score = 100.0
        _feature_window.clear()
        print(f"[AI] Lap {new_lap_num} - focus reset to 100%")


def predict_single(speed, steering_angle, throttle, brake, lap_time, lap_distance):
    """
    Predict focus using sliding window batch (fixes BatchNorm single-sample bug).
    The model needs batch_size > 1 for BatchNorm to produce varied outputs.
    We maintain a window of recent feature vectors and predict the whole batch.
    """
    global _model, _scaler, _prev_point, _feature_window

    # Rule: car stopped = not focused
    if speed < 5:
        _prev_point = {'steeringAngle': steering_angle, 'brake': brake, 'throttle': throttle}
        smoothed = _apply_smoothing(0.0)
        return {'focusScore': round(smoothed, 1), 'isFocused': smoothed > 50, 'confidence': 0, 'method': 'rule-stopped'}

    if _model is None or _scaler is None:
        return {'focusScore': round(_smoothed_focus_score, 1), 'isFocused': True, 'confidence': 0, 'method': 'no-model'}

    try:
        current = {'speed': speed, 'steeringAngle': steering_angle, 'throttle': throttle, 'brake': brake, 'lapTime': lap_time}
        feature_vector = _build_feature_vector(current, _prev_point)
        _prev_point = {'steeringAngle': steering_angle, 'brake': brake, 'throttle': throttle}

        # Add to sliding window
        _feature_window.append(feature_vector)

        # Need at least 6 samples for BatchNorm to produce meaningful variance
        if len(_feature_window) < 6:
            return {'focusScore': round(_smoothed_focus_score, 1), 'isFocused': True, 'confidence': 0.5, 'method': 'warming-up'}

        # Batch prediction: feed entire window, take last result
        X = np.array(list(_feature_window))
        # Use DataFrame with feature names to suppress sklearn warning
        import pandas as pd
        feature_names = ['Speed', 'Steering_Angle', 'Throttle', 'Brake', 'Steering_Diff', 'Brake_Diff', 'Throttle_Diff', 'Lap_Time_Second']
        X_df = pd.DataFrame(X, columns=feature_names)
        X_scaled = _scaler.transform(X_df)

        import tensorflow as tf
        X_tensor = tf.constant(X_scaled, dtype=tf.float32)
        predictions = _model(X_tensor, training=True).numpy()

        # Last prediction = current data point
        score = float(predictions[-1][0])
        raw_pct = score * 100.0

        # Apply EMA smoothing
        smoothed = _apply_smoothing(raw_pct)

        return {
            'focusScore': round(smoothed, 1),
            'isFocused': smoothed > 50,
            'confidence': round(score, 4),
            'method': 'ai-model',
            'rawScore': round(raw_pct, 1),
        }
    except Exception as e:
        print(f"[AI] Prediction error: {e}")
        return {'focusScore': round(_smoothed_focus_score, 1), 'isFocused': True, 'confidence': 0, 'method': 'error'}


# =============================================================================
# STANDALONE TEST (Run: py ai_predictor.py)
# =============================================================================

def test_prediction_flow():
    """
    Test 3 driving states to verify the prediction pipeline works correctly.
    Shows raw AI output vs smoothed output for each state transition.
    """
    import time
    global _smoothed_focus_score, _feature_window, _prev_point

    print("=" * 65)
    print("  PREDICTION FLOW TEST")
    print("  Tests: Full Throttle -> Hard Braking -> Stopped")
    print("=" * 65)

    # Reset state
    _smoothed_focus_score = 100.0
    _feature_window.clear()
    _prev_point = {'steeringAngle': 0, 'brake': 0, 'throttle': 0}

    # State A: Full throttle, high speed (should be HIGH focus ~70%+)
    print("\n--- STATE A: Full Throttle Straight (expect 60-80%) ---")
    for i in range(20):
        r = predict_single(
            speed=280 + np.random.uniform(-10, 10),
            steering_angle=np.random.uniform(-0.02, 0.02),  # Tiny corrections
            throttle=0.95 + np.random.uniform(0, 0.05),
            brake=0,
            lap_time=30 + i * 0.5,
            lap_distance=1000 + i * 50,
        )
        if i % 4 == 0:
            print(f"  [{i:2d}] Raw: {r.get('rawScore', '?'):>5}%  Smoothed: {r['focusScore']:>5}%  Method: {r['method']}")

    # State B: Hard braking into corner (should DROP to ~30-50%)
    print("\n--- STATE B: Hard Braking + Steering (expect 30-50%) ---")
    for i in range(20):
        r = predict_single(
            speed=150 - i * 5,
            steering_angle=0.3 + np.random.uniform(0, 0.2),  # Turning
            throttle=0,
            brake=0.8 + np.random.uniform(0, 0.2),
            lap_time=40 + i * 0.3,
            lap_distance=2000 + i * 20,
        )
        if i % 4 == 0:
            print(f"  [{i:2d}] Raw: {r.get('rawScore', '?'):>5}%  Smoothed: {r['focusScore']:>5}%  Method: {r['method']}")

    # State C: Stopped / No input (should trigger rule -> 0%)
    print("\n--- STATE C: Car Stopped (expect -> 0%) ---")
    for i in range(10):
        r = predict_single(
            speed=max(0, 3 - i),
            steering_angle=0,
            throttle=0,
            brake=0,
            lap_time=50,
            lap_distance=2500,
        )
        if i % 2 == 0:
            print(f"  [{i:2d}] Raw: {r.get('rawScore', '?'):>5}%  Smoothed: {r['focusScore']:>5}%  Method: {r['method']}")

    print("\n" + "=" * 65)
    print("  TEST COMPLETE")
    print("=" * 65)


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    load_model()
    test_prediction_flow()
