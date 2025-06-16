let timers = {};
let pythonProgramRunning = false;
let lastDetectedEmotion = null;

window.onload = () => {
    let moodHistory = JSON.parse(localStorage.getItem("moodHistory") || "[]");
    renderMoodChart();
    applySavedColors();
    document.getElementById('settings-button').addEventListener('click', () => {openSettingsPanel();});
};

const closeBtn = document.getElementById("popup-close");
if (closeBtn) {
  closeBtn.addEventListener("click", closePopup);
}

function checkPythonProgramStatus() {
    fetch(`http://localhost:8080/latest_emotion_data.json?timestamp=${new Date().getTime()}`)
        .then((response) => {
            if (!response.ok) throw new Error("Python program not running");
            pythonProgramRunning = true;
            const statusEl = document.getElementById('program-status');
            if (statusEl) statusEl.innerText = "Python Program: Running";
        })
        .catch(() => {
            pythonProgramRunning = false;
            const statusEl = document.getElementById('program-status');
            if (statusEl) statusEl.innerText = "Python Program: Not Running";
        });
}

setInterval(checkPythonProgramStatus, 5000);
setInterval(fetchEmotionData, 3000);

function fetchEmotionData() {
    if (!pythonProgramRunning) return;

    const timestamp = new Date().getTime();
    fetch(`http://localhost:8080/latest_emotion_data.json?timestamp=${timestamp}`)
        .then(response => response.json())
        .then(data => {
            const statusEl = document.getElementById('program-status');
            if (!data || (!data.facial_emotion && !data.speech_emotion)) {
                if (statusEl) statusEl.innerText = "No Emotion Detected";
                return;
            }

            let emotion = decideCombinedEmotion(data.facial_emotion, data.speech_emotion);

            if (emotion !== lastDetectedEmotion) {
                lastDetectedEmotion = emotion;
                const emotionIcons = {
                    happiness: "😊",
                    sadness: "😢",
                    anger: "😠",
                    fear: "😨",
                    surprise: "😲",
                    disgust: "🤢",
                    neutral: "😐"
                };
                if (statusEl) statusEl.innerText = `Detected Emotion: ${emotionIcons[emotion] || ""} ${emotion}`;
                handleEmotionWithTimer(emotion);
            }

            let moodHistory = JSON.parse(localStorage.getItem("moodHistory") || "[]");
            let moodEntry = {
                timestamp: new Date().getTime(),
                mood: emotion
            };
            moodHistory.push(moodEntry);
            localStorage.setItem("moodHistory", JSON.stringify(moodHistory));
            updateMoodChart();
        })
        .catch(error => {
            console.error("Fetch error:", error);
            const statusEl = document.getElementById('program-status');
            if (statusEl) statusEl.innerText = "Error Fetching Data";
        });
}

function updateMoodChart() {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;
    const oldCanvas = document.getElementById('moodChart');
    if (oldCanvas) oldCanvas.remove();
    const canvas = document.createElement('canvas');
    canvas.id = 'moodChart';
    chartContainer.appendChild(canvas);
    renderMoodChart();
}

function renderMoodChart() {
    const canvas = document.getElementById('moodChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const data = JSON.parse(localStorage.getItem("moodHistory") || "[]").slice(-10);

    const labels = data.map(entry => new Date(entry.timestamp).toLocaleTimeString());
    const moods = data.map(entry => entry.mood);

    const moodColors = {
        happiness: '#FFD166',
        sadness: '#6C757D',
        anger: '#FF595E',
        fear: '#457B9D',
        surprise: '#F4A261',
        disgust: '#588157',
        neutral: '#CCCCCC'
    };

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Recent Moods',
                data: moods,
                backgroundColor: moods.map(m => moodColors[m] || '#999'),
            }]
        },
        options: {
            scales: {
                y: {
                    type: 'category',
                    labels: Object.keys(moodColors),
                    title: { display: true, text: 'Mood Type' }
                }
            }
        }
    });
}

function decideCombinedEmotion(facial, speech) {
    if (facial === "neutral" && speech !== "N/A" && speech !== "neutral") return speech;
    if (speech === "N/A" || speech === "neutral") return facial;
    return facial !== "neutral" ? facial : speech;
}

function downloadMoodLog(format) {
    const data = JSON.parse(localStorage.getItem("moodHistory") || "[]");

    if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        downloadFile(url, "mood_history.json");
    } else if (format === "csv") {
        const csv = "timestamp,mood\n" + data.map(e => `${e.timestamp},${e.mood}`).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        downloadFile(url, "mood_history.csv");
    }
}

function downloadFile(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function handleEmotionWithTimer(emotion) {
    if (timers[emotion]) return;
    clearTimersForOtherEmotions();

    timers[emotion] = setTimeout(() => {
        applyEmotionBehavior(emotion);
        clearTimersForOtherEmotions();
    }, 3000);
}

function clearTimersForOtherEmotions() {
    Object.keys(timers).forEach(emotion => clearTimeout(timers[emotion]));
    timers = {};
}

function resetColorsToDefault() {
    document.documentElement.style.setProperty('--primary-color', '#FFD166');
    document.documentElement.style.setProperty('--secondary-color', '#6C757D');
    document.documentElement.style.setProperty('--font-color', '#333333');
    document.documentElement.style.setProperty('--hover-color', '#FFD166');
    
    localStorage.removeItem('custom-bg-color');
    localStorage.removeItem('custom-text-color');
    localStorage.removeItem('custom-accent-color');
}


function applyEmotionBehavior(emotion) {
    resetColorsToDefault();
    const emotionMap = {
        anger: handleAngerEmotion,
        happiness: handleHappinessEmotion,
        disgust: handleDisgustEmotion,
        fear: handleFearEmotion,
        sadness: handleSadnessEmotion,
        neutral: handleNeutralEmotion,
        surprise: handleSurpriseEmotion
    };
    if (emotionMap[emotion]) emotionMap[emotion]();
}

function updateColors(primary, secondary, font, hover) {
    document.documentElement.style.transition = "all 0.5s ease-in-out";
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.documentElement.style.setProperty('--font-color', font);
    document.documentElement.style.setProperty('--hover-color', hover);
}

function openSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    
    const savedBg = localStorage.getItem('custom-bg-color') || '#ffffff';
    const savedText = localStorage.getItem('custom-text-color') || '#000000';
    const savedAccent = localStorage.getItem('custom-accent-color') || '#007bff';

    document.getElementById('bg-color-picker').value = savedBg;
    document.getElementById('text-color-picker').value = savedText;
    document.getElementById('accent-color-picker').value = savedAccent;

    panel.style.display = 'block';

    ['bg-color-picker', 'text-color-picker', 'accent-color-picker'].forEach(id => {
        document.getElementById(id).addEventListener('input', previewColors);
    });

    document.getElementById('apply-theme').onclick = () => {
        applyColors();  
        panel.style.display = 'none';
    };

    document.getElementById('close-settings').onclick = () => {
        panel.style.display = 'none';
        ['bg-color-picker', 'text-color-picker', 'accent-color-picker'].forEach(id => {
            document.getElementById(id).removeEventListener('input', previewColors);
        });
        applySavedColors();  
    };

    applySavedColors();
}

function previewColors() {
    const bg = document.getElementById('bg-color-picker').value;
    const text = document.getElementById('text-color-picker').value;
    const accent = document.getElementById('accent-color-picker').value;

    document.body.style.backgroundColor = bg;
    document.body.style.color = text;
    document.documentElement.style.setProperty('--primary-color', accent);
}

function applyColors() {
    const bg = document.getElementById('bg-color-picker').value;
    const text = document.getElementById('text-color-picker').value;
    const accent = document.getElementById('accent-color-picker').value;

    localStorage.setItem('custom-bg-color', bg);
    localStorage.setItem('custom-text-color', text);
    localStorage.setItem('custom-accent-color', accent);

    applySavedColors();
}

function applySavedColors() {
    const bg = localStorage.getItem('custom-bg-color') || '#ffffff';
    const text = localStorage.getItem('custom-text-color') || '#000000';
    const accent = localStorage.getItem('custom-accent-color') || '#007bff';

    document.body.style.backgroundColor = bg;
    document.body.style.color = text;
    document.documentElement.style.setProperty('--primary-color', accent);
}


window.addEventListener('load', applySavedColors);

function showPopup(title, message, buttonText, buttonCallback) {
    const popup = document.getElementById('popup');
    if (!popup) return;

    const titleEl = document.getElementById('popup-title');
    const messageEl = document.getElementById('popup-text');
    const buttonEl = document.getElementById('popup-button');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.innerHTML = message;
    if (buttonEl) {
        buttonEl.textContent = buttonText;
        buttonEl.onclick = buttonCallback;
    }

    popup.style.display = 'block';
}

function closePopup() {
    let popup = document.getElementById('popup');
    if (popup) popup.remove();
    else console.warn("Popup element not found!");
}

function handleHappinessEmotion() {
    updateColors('#FFD700', '#FFA500', '#333333', '#FFC107');
    showPopup("Feeling Happy?", "Why not explore some inspirational quotes?", "Show Quote", displayRandomQuote);
    triggerConfetti();
}

function displayRandomQuote() {
    const quotes = [
        "Happiness depends upon ourselves. – Aristotle",
        "The purpose of our lives is to be happy. – Dalai Lama",
        "Happiness is not something ready made. It comes from your own actions. – Dalai Lama",
        "Do more of what makes you happy."
    ];
    const selectedQuote = quotes[Math.floor(Math.random() * quotes.length)];
    showPopup("Inspirational Quote", selectedQuote, "Thanks", closePopup);
}

function triggerConfetti() {
    if (typeof confetti !== "undefined") {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
        });
    }
}

function startBreathingBubble() {
  const bubble = document.getElementById('breathe-bubble');
  bubble.classList.add('show'); 
  setTimeout(() => {
    stopBreathingBubble();
  }, 6000);
}

function stopBreathingBubble() {
    const bubble = document.getElementById('breathe-bubble');
    bubble.classList.remove('show');  
}

function startFearGrounding() {
    const groundingText = `
        <p>Look around and name:</p>
        <ul>
            <li><strong>5</strong> things you can <strong>see</strong></li>
            <li><strong>4</strong> things you can <strong>touch</strong></li>
            <li><strong>3</strong> things you can <strong>hear</strong></li>
            <li><strong>2</strong> things you can <strong>smell</strong></li>
            <li><strong>1</strong> thing you can <strong>taste</strong></li>
        </ul>
    `;
    showPopup("Grounding Exercise", groundingText, "Done", closePopup);
}


function hiddenEasterEgg() {
  const egg = document.createElement('div');
  egg.id = "easter-egg";
  egg.textContent = "🔎 Click me!";
  egg.style = "position:fixed;bottom:10%;right:5%;cursor:pointer;font-size:2rem;";
  egg.onclick = () => {
    showPopup("You found it! 🥚", "Surprise egg unlocked a secret theme.", "Try It!", () => {
      updateColors('#8E44AD','#9B59B6','#FFF','#D2B4DE');
    });
    egg.remove();
  };
  document.body.appendChild(egg);
}

function handleSurpriseEmotion() {
    updateColors('#D3D3D3', '#ADD8E6', '#333333', '#B0C4DE');
    showPopup("Take a breath!", "Let’s do a quick 3 second breath to settle.", "Breathe", () => startBreathingBubble());
}

function handleAngerEmotion() {
    updateColors('#ADD8E6', '#90EE90', '#333333', '#87CEFA');
    showPopup("Feeling Frustrated?", "Try a quick breathing exercise.", "Start Exercise", () => startBreathingBubble());
}

function handleDisgustEmotion() {
    updateColors('#FFFFFF', '#D3D3D3', '#333333', '#F5F5DC');
    showPopup("Is the theme not to your liking?", "Customise your experience with a personalised theme!", "Customise", () => openSettingsPanel());
}

function handleFearEmotion() {
    updateColors('#ADD8E6', '#90EE90', '#333333', '#98FB98');
    showPopup(
        "Feeling Anxious?","Try grounding yourself with a sensory exercise.","Start Grounding",() => startFearGrounding()
    );
}

function handleSadnessEmotion() {
    updateColors('#FFFACD', '#90EE90', '#333333', '#98FB98');
    showPopup("Feeling a bit down?", "Your little plant needs some care! 🌱", "Water Me", () => {
        displayThankYouMessage();
    });
}

function handleNeutralEmotion() {
    updateColors('#FF7F50', '#008080', '#333333', '#20B2AA');
    hiddenEasterEgg();
}

function displayThankYouMessage() {
    showPopup("Thank you!", "Your plant feels better now. 💧🌼", "You're Welcome", closePopup);
}

document.getElementById("submit-quiz-btn").addEventListener("click", function () {
    const q1 = document.getElementById("q1").value;
    const q2 = document.getElementById("q2").value;
    const q3 = document.getElementById("q3").value;
    const q4 = document.getElementById("q4").value;
    const q5 = document.getElementById("q5").value;
    let score = 0;

    if (q1 === "Tightened facial muscles") score++;
    if (q2 === "Furrowed brows") score++;
    if (q3 === "To create user-friendly and empathetic systems") score++;
    if (q4 === "Understanding how people think and feel") score++;
    if (q5 === "To make the experience more personal and friendly") score++;
    const resultText = `You got ${score} out of 5 correct!`;
    document.getElementById("quiz-result").innerText = resultText;

    showPopup("Quiz Result", resultText);
});

