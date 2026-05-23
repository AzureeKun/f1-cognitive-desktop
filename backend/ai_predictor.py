"""
AI Focus Predictor Module

Loads the trained ANN model (model_kognitif_ann.h5) and scaler (scaler_telemetri.pkl)
to make real-time cognitive focus predictions from F1 telemetry data.

Input features (from telemetry_data_collector.py):
- Speed (km/h)
- Steering_Angle (degrees)
- Throttle (0.0 - 1.0)
- Brake (0.0 - 1.0)
- Lap_Time_Second (seconds)
- Lap_Distance (meters)

Output:
- Focus classification: 1 (Focused) or 0 (Distracted)
- Confidence score: 0.0 - 1.0
"""

import os
import numpy as np
import joblib

# Paths to model files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, 'ai_model', 'model_kognitif_gwo_pso_ann.h5')
SCALER_PATH = os.path.join(BASE_DIR, 'ai_model', 'scaler_telemetri.pkl')

# Global model and scaler instances
_model = None
_scaler = None


def load_model():
    """Load the ANN model and scaler. Called once on startup."""
    global _model, _scaler

    # Load scaler
    if os.path.exists(SCALER_PATH):
        _scaler = joblib.load(SCALER_PATH)
        print(f"[AI] ✓ Scaler loaded: {SCALER_PATH}")
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


def predict_focus(telemetry_data):
    """
    Predict focus level from a batch of telemetry data points.

    Args:
        telemetry_data: list of dicts with keys:
            [speed, steeringAngle, throttle, brake, lapTime, lapDistance]

    Returns:
        dict with:
            - focusLevel: "High Focus" | "Medium Focus" | "Low Focus"
            - confidenceScore: float 0.0-1.0
            - averageFocusPct: float 0-100
            - predictions: list of individual predictions
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

    # Prepare feature matrix
    # Features order must match training: Speed, Steering_Angle, Throttle, Brake, Lap_Time_Second, Lap_Distance
    features = []
    for point in telemetry_data:
        features.append([
            point.get('speed', 0),
            point.get('steeringAngle', 0),
            point.get('throttle', 0),
            point.get('brake', 0),
            point.get('lapTime', 0),
            point.get('lapDistance', 0),
        ])

    X = np.array(features)

    # Scale features using the trained scaler
    try:
        X_scaled = _scaler.transform(X)
    except Exception as e:
        print(f"[AI] Scaler error: {e}")
        return {
            'error': f'Scaler error: {str(e)}',
            'focusLevel': 'Unknown',
            'confidenceScore': 0,
            'averageFocusPct': 0,
        }

    # Make predictions
    try:
        predictions_raw = _model.predict(X_scaled, verbose=0)

        # Handle different output shapes
        if predictions_raw.shape[-1] == 1:
            # Binary output (sigmoid): single value 0-1
            confidence_scores = predictions_raw.flatten()
            predictions = (confidence_scores > 0.5).astype(int)
        elif predictions_raw.shape[-1] == 2:
            # Two-class softmax output
            confidence_scores = predictions_raw[:, 1]  # Probability of "Focused"
            predictions = np.argmax(predictions_raw, axis=1)
        elif predictions_raw.shape[-1] == 3:
            # Three-class softmax (High/Medium/Low)
            confidence_scores = np.max(predictions_raw, axis=1)
            predictions = np.argmax(predictions_raw, axis=1)
        else:
            confidence_scores = predictions_raw.flatten()
            predictions = (confidence_scores > 0.5).astype(int)

        # Calculate overall focus percentage
        focus_pct = float(np.mean(confidence_scores) * 100)
        avg_confidence = float(np.mean(confidence_scores))
        min_focus = float(np.min(confidence_scores) * 100)
        max_focus = float(np.max(confidence_scores) * 100)

        # Determine overall focus level
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
        }

    except Exception as e:
        print(f"[AI] Prediction error: {e}")
        return {
            'error': f'Prediction error: {str(e)}',
            'focusLevel': 'Unknown',
            'confidenceScore': 0,
            'averageFocusPct': 0,
        }


def predict_single(speed, steering_angle, throttle, brake, lap_time, lap_distance):
    """
    Predict focus for a single telemetry data point.
    Used for real-time dashboard updates.

    Returns:
        dict with focusScore (0-100), isFocused (bool), confidence (0-1)
    """
    global _model, _scaler

    if _model is None or _scaler is None:
        return {'focusScore': 50, 'isFocused': True, 'confidence': 0}

    try:
        X = np.array([[speed, steering_angle, throttle, brake, lap_time, lap_distance]])
        X_scaled = _scaler.transform(X)
        prediction = _model.predict(X_scaled, verbose=0)

        if prediction.shape[-1] == 1:
            score = float(prediction[0][0])
        elif prediction.shape[-1] >= 2:
            score = float(prediction[0][1]) if prediction.shape[-1] == 2 else float(np.max(prediction[0]))
        else:
            score = float(prediction[0][0])

        return {
            'focusScore': round(score * 100, 1),
            'isFocused': score > 0.5,
            'confidence': round(score, 4),
        }
    except Exception as e:
        print(f"[AI] Single prediction error: {e}")
        return {'focusScore': 50, 'isFocused': True, 'confidence': 0}
