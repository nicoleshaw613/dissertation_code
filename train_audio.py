import os
import librosa
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, LSTM, Dense, Flatten, Dropout, TimeDistributed

DATASET_PATH = r"C:\Users\nicol\Documents\School\emotion_detection\Tess" 

# emotion labels 
emotion_labels = {
    "OAF_disgust": "disgust", "OAF_Fear": "fear", "OAF_happy": "happiness",
    "OAF_neutral": "neutral", "OAF_Pleasant_surprise": "surprise",
    "OAF_Sad": "sadness", "YAF_angry": "anger", "YAF_disgust": "disgust",
    "YAF_fear": "fear"
}

# Converting labels to integer classes
label_to_index = {label: idx for idx, label in enumerate(set(emotion_labels.values()))}
num_classes = len(label_to_index)

# Parameters for audio processing
SAMPLE_RATE = 22050  # Standard for speech recognition
N_MFCC = 40  # Number of MFCC features
MAX_PAD_LEN = 100  # Ensures all MFCCs have the same length

# Function to extract MFCC features from an audio file
def extract_features(file_path, max_pad_len=MAX_PAD_LEN):
    y, sr = librosa.load(file_path, sr=SAMPLE_RATE)  
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)  

    pad_width = max_pad_len - mfccs.shape[1]
    if pad_width > 0:
        mfccs = np.pad(mfccs, pad_width=((0, 0), (0, pad_width)), mode='constant')
    else:
        mfccs = mfccs[:, :max_pad_len]

    return mfccs

X, y = [], []

for folder in os.listdir(DATASET_PATH):
    folder_path = os.path.join(DATASET_PATH, folder)
    if os.path.isdir(folder_path) and folder in emotion_labels:  # Checking if it's a valid emotion folder
        for file in os.listdir(folder_path):
            if file.endswith(".wav"):  
                file_path = os.path.join(folder_path, file)
                X.append(extract_features(file_path)) 
                y.append(label_to_index[emotion_labels[folder]])  

# Converting to numpy arrays
X = np.array(X)
y = np.array(y)

# Reshaping input for CNNs
X = np.expand_dims(X, axis=-1)  # Adding channel dimension for CNN

y = to_categorical(y, num_classes=num_classes)

# Splitting dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"Dataset loaded: {len(X_train)} training samples, {len(X_test)} testing samples.")


# Defining the CNN-LSTM model
model = Sequential([
    Conv2D(32, kernel_size=(3, 3), activation='relu', input_shape=(N_MFCC, MAX_PAD_LEN, 1)),
    MaxPooling2D(pool_size=(2, 2)),
    Dropout(0.3),

    Conv2D(64, kernel_size=(3, 3), activation='relu'),
    MaxPooling2D(pool_size=(2, 2)),
    Dropout(0.3),

    TimeDistributed(Flatten()),  # Converting CNN output to sequence
    LSTM(64, return_sequences=False),  # LSTM to capture temporal features

    Dense(32, activation='relu'),
    Dropout(0.3),
    Dense(num_classes, activation='softmax')  # Outputting layer for classification
])

model.compile(loss='categorical_crossentropy', optimizer='adam', metrics=['accuracy'])

model.summary()

history = model.fit(X_train, y_train, epochs=50, batch_size=16, validation_data=(X_test, y_test))

model.save('voice_model.h5')

loss, accuracy = model.evaluate(X_test, y_test)
print(f"Test Accuracy: {accuracy * 100:.2f}%")