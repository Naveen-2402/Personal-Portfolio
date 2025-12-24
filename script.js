/* =========================================
   GLOBAL STATE & UTILS
   ========================================= */
const state = {
    data: null,
    hero: {
        width: 0,
        height: 0,
        isMobile: false,
        mouse: { x: null, y: null, lastX: null, lastY: null },
        particles: [],
        img: new Image(),
        isGenerating: true,
        isComplete: false,
        hasTriggered: false,
        triggerTime: null,
        rafId: null,
        generationProgress: 0
    },
    modelCard: {
        isStreaming: false,
        charIndex: 0,
        jsonString: "",
        timerInterval: null,
        scanInterval: null,
        cells: []
    },
    training: {
        hasRendered: false,
        observer: null,
        zones: [],
        baseData: [], // NEW: Stores the normalized curve shape
        dataPoints: [] 
    },
    neural: {
        isFirstClick: true,
        archLines: [],
        activeAgentId: null,
        resizeObserver: null
    },
    contact: {
        isRunning: false,
        defaultPrompt: '<span class="path">user@naveen-portfolio:~/scripts$</span> <span class="cursor-blink">_</span>'
    }
};

// Fetch Data
async function loadData() {
    try {
        const response = await fetch('data.json');
        state.data = await response.json();
        initHeroText();
        initModelCard();
        initTrainingSection();
        initNeuralSection();
        initContactSection();
        initFooter();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// Global Intersection Observer for Re-triggering Animations
const observerOptions = {
    threshold: 0.1 // Trigger when 10% of section is visible
};

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // 1. General CSS Transition Trigger
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
        } else {
            entry.target.classList.remove('in-view');
        }

        // 2. Section Specific Logic
        
        // HERO SECTION
        if(entry.target.closest('#hero-section')) {
            if(!entry.isIntersecting && state.hero.isComplete) {
                resetHeroAnimation();
            }
        }

        // MODEL CARD SECTION
        if(entry.target.id === 'model-card-section') {
            if(entry.isIntersecting) {
                startModelCardAnimation();
            } else {
                resetModelCardAnimation();
            }
        }
        // TRAINING SECTION
        if(entry.target.id === 'training-dashboard') {
            if(entry.isIntersecting) {
                renderTrainingGraph(); // Ensure size is correct on entry
                startTrainingAnimation();
            } else {
                resetTrainingAnimation();
            }
        }
        if(entry.target.id === 'neural-projects') {
            if(entry.isIntersecting) {
                startNeuralAnimation();
                // Redraw lines after transition matches positions
                setTimeout(drawNeuralConnections, 600);
            } else {
                resetNeuralAnimation();
            }
        }
        // CONTACT SECTION
        if(entry.target.id === 'terminal-contact') {
            if(entry.isIntersecting) {
                startContactAnimation();
            } else {
                resetContactAnimation();
            }
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initHeroCanvas();
    
    // Start observing elements that need animation
    const wrappers = document.querySelectorAll('.animate-wrapper');
    wrappers.forEach(el => sectionObserver.observe(el));
    sectionObserver.observe(document.getElementById('model-card-section'));
    sectionObserver.observe(document.getElementById('training-dashboard'));
    sectionObserver.observe(document.getElementById('neural-projects'));
    sectionObserver.observe(document.getElementById('terminal-contact'));
});

/* =========================================
   SECTION 1: HERO LOGIC
   ========================================= */

function initHeroText() {
    const d = state.data.hero;
    document.getElementById('hero-role').innerText = d.role;
    document.getElementById('hero-prefix').innerText = d.headline_prefix;
    
    const gradEl = document.getElementById('hero-gradient');
    gradEl.innerText = d.headline_gradient;
    gradEl.setAttribute('data-text', d.headline_gradient);
    
    document.getElementById('hero-subtitle').innerText = d.subtitle;
    
    const stackContainer = document.getElementById('hero-stack');
    d.tech_stack.forEach(tech => {
        const span = document.createElement('span');
        span.className = 'tech-badge';
        span.innerText = tech;
        stackContainer.appendChild(span);
    });

    document.getElementById('stat-sampler').innerText = d.stats.sampler;
    document.getElementById('stat-steps').innerText = d.stats.steps;
    document.getElementById('stat-roi').innerText = d.stats.roi;
}

function initHeroCanvas() {
    const canvas = document.getElementById('noise-canvas');
    const contentCanvas = document.getElementById('content-canvas');
    const heroSection = document.getElementById('hero-section');
    
    if(!canvas || !contentCanvas) return;

    state.hero.noiseCtx = canvas.getContext('2d');
    state.hero.contentCtx = contentCanvas.getContext('2d');
    
    // Image Loading
    state.hero.img.src = 'images/1.jpeg';
    state.hero.img.onload = () => createParticles();
    state.hero.img.onerror = () => createFallbackParticles();

    // Resize Handler
    function resize() {
        state.hero.width = canvas.width = contentCanvas.width = heroSection.offsetWidth;
        state.hero.height = canvas.height = contentCanvas.height = heroSection.offsetHeight;
        state.hero.isMobile = state.hero.width <= 968;
        
        // Recalculate Avatar Geometry
        if (state.hero.isMobile) {
            state.hero.avatarRadius = Math.min(state.hero.width, state.hero.height) * 0.25; 
            state.hero.avatarX = state.hero.width / 2;
            state.hero.avatarY = state.hero.height * 0.3; 
        } else {
            state.hero.avatarRadius = Math.min(state.hero.width, state.hero.height) * 0.22;
            if (state.hero.avatarRadius > 250) state.hero.avatarRadius = 250;
            state.hero.avatarX = state.hero.width * 0.75; 
            state.hero.avatarY = state.hero.height / 2;
        }
        
        // Re-create particles on resize to fit new coords
        if(state.hero.isComplete) createParticles(); 
    }
    
    window.addEventListener('resize', resize);
    resize(); // Initial call

    // Animation Loop
    state.hero.startTime = Date.now();
    animateHero();

    // Event Listeners for Interaction
    heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        state.hero.mouse.x = e.clientX - rect.left;
        state.hero.mouse.y = e.clientY - rect.top;
        
        document.getElementById('coords').innerText = `x:${Math.floor(state.hero.mouse.x)} y:${Math.floor(state.hero.mouse.y)}`;
        triggerHeroGeneration();
    });

    window.addEventListener('scroll', triggerHeroGeneration);
}

function createParticles() {
    state.hero.particles = [];
    const { width, height, avatarX, avatarY, avatarRadius, img, isMobile } = state.hero;
    
    // Create temporary canvas for image data extraction
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    tempCtx.save();
    tempCtx.beginPath();
    tempCtx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    tempCtx.closePath();
    tempCtx.clip();

    // Draw Image (Cover Fit Logic)
    const aspect = img.width / img.height;
    let drawW, drawH, drawX, drawY;
    const boxSize = avatarRadius * 2;
    
    if (aspect > 1) {
        drawH = boxSize;
        drawW = boxSize * aspect;
        drawX = avatarX - avatarRadius - ((drawW - boxSize) / 2);
        drawY = avatarY - avatarRadius;
    } else {
        drawW = boxSize;
        drawH = boxSize / aspect;
        drawX = avatarX - avatarRadius;
        drawY = avatarY - avatarRadius - ((drawH - boxSize) / 2);
    }
    tempCtx.drawImage(img, drawX, drawY, drawW, drawH);
    tempCtx.restore();

    // Pixel Scanning
    const imgData = tempCtx.getImageData(0, 0, width, height).data;
    const density = isMobile ? 3 : 2; 
    
    const startX = Math.floor(Math.max(0, avatarX - avatarRadius));
    const endX = Math.floor(Math.min(width, avatarX + avatarRadius));
    const startY = Math.floor(Math.max(0, avatarY - avatarRadius));
    const endY = Math.floor(Math.min(height, avatarY + avatarRadius));

    for (let y = startY; y < endY; y += density) {
        for (let x = startX; x < endX; x += density) {
            const dx = x - avatarX;
            const dy = y - avatarY;
            if (dx*dx + dy*dy > avatarRadius * avatarRadius) continue;

            const index = (y * width + x) * 4;
            if (imgData[index + 3] > 50) {
                state.hero.particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    targetX: x,
                    targetY: y,
                    vx: 0, vy: 0,
                    color: `rgba(${imgData[index]},${imgData[index+1]},${imgData[index+2]},${imgData[index+3]/255})`,
                    size: Math.random() * 2.0 + 1.2,
                    isImage: true
                });
            }
        }
    }

    // Add Background Noise
    const particleCount = isMobile ? 600 : 1500;
    for (let i = 0; i < particleCount; i++) {
        state.hero.particles.push({
            x: Math.random() * width, 
            y: Math.random() * height,
            targetX: Math.random() * width, 
            targetY: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            color: Math.random() > 0.5 ? '#fbbf24' : '#ffffff', // Using accent color
            size: Math.random() * 1.5 + 0.5,
            isNoise: true
        });
    }
}

function createFallbackParticles() {
    // Basic fallback if image fails
    const { width, height, avatarX, avatarY, avatarRadius } = state.hero;
    for(let i=0; i<3000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * avatarRadius;
        state.hero.particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            targetX: avatarX + Math.cos(angle) * r, 
            targetY: avatarY + Math.sin(angle) * r,
            vx: 0, vy: 0,
            color: Math.random() > 0.5 ? '#fbbf24' : '#ffffff',
            size: Math.random() * 2.0,
            isImage: true
        });
    }
}

function triggerHeroGeneration() {
    if (state.hero.hasTriggered || !state.hero.img.complete) return;
    state.hero.hasTriggered = true;
    state.hero.triggerTime = Date.now();
}

function resetHeroAnimation() {
    // Call this when scrolling UP away from section to reset state
    state.hero.hasTriggered = false;
    state.hero.isGenerating = true;
    state.hero.isComplete = false;
    state.hero.generationProgress = 0;
    
    // Reset UI
    document.getElementById('prompt').classList.remove('hidden');
    document.getElementById('stats').classList.remove('visible');
    document.getElementById('content').classList.remove('visible');
    document.getElementById('readout').classList.remove('visible');
    document.getElementById('progress').style.width = '0%';
    
    // Clear canvas
    const { width, height } = state.hero;
    state.hero.contentCtx.clearRect(0,0, width, height);
}

function animateHero() {
    requestAnimationFrame(animateHero);
    
    const { isGenerating, isComplete, hasTriggered, triggerTime, width, height, avatarX, avatarY, avatarRadius, noiseCtx, contentCtx, particles, mouse } = state.hero;

    // 1. Diffusion Phase
    if (isGenerating && hasTriggered) {
        const now = Date.now();
        const elapsed = now - triggerTime;
        let progress = 0;

        if (elapsed <= 2000) progress = (elapsed / 2000) * 0.8;
        else if (elapsed <= 4000) progress = 0.8 + ((elapsed - 2000) / 2000) * 0.2;
        else progress = 1.0;
        
        state.hero.generationProgress = progress;

        // UI Updates
        document.getElementById('progress').style.width = `${progress * 100}%`;
        document.getElementById('step-count').innerText = Math.floor(progress * 50);

        if (progress > 0.01) {
            document.getElementById('prompt').classList.add('hidden');
            document.getElementById('stats').classList.add('visible');
        }

        if (progress >= 1) {
            state.hero.isGenerating = false;
            state.hero.isComplete = true;
            noiseCtx.clearRect(0, 0, width, height);
            document.getElementById('stats').classList.remove('visible');
            document.getElementById('content').classList.add('visible');
            document.getElementById('readout').classList.add('visible');
            return; // Switch to particle phase next frame
        }

        // Noise Render
        let blockSize = 40 * (1 - progress);
        if (blockSize < 2) blockSize = 2;

        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                const dx = (x + blockSize/2) - avatarX;
                const dy = (y + blockSize/2) - avatarY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const inCircle = dist < avatarRadius + 10;
                const randomBackground = Math.random() > (0.9 + (progress * 0.1));
                
                if (inCircle || randomBackground) {
                    const noiseVal = (1 - progress) * 100;
                    let r = 20, g = 20, b = 30;
                    if (inCircle) {
                        r += (Math.random()) * noiseVal * 2;
                        g += (Math.random()) * noiseVal * 2;
                        b += (Math.random()) * noiseVal * 2;
                    } else {
                        r = 0; g = 10; b = 20; 
                        r += (Math.random()) * noiseVal * 0.5;
                        g += (Math.random()) * noiseVal * 0.5;
                        b += (Math.random()) * noiseVal * 0.5;
                    }
                    noiseCtx.fillStyle = `rgb(${r},${g},${b})`;
                    noiseCtx.fillRect(x, y, blockSize + 1, blockSize + 1);
                }
            }
        }
    }

    // 2. Particle Phase
    if (isComplete) {
        contentCtx.fillStyle = 'rgba(12, 10, 9, 0.15)'; // Match BG color trail
        contentCtx.fillRect(0, 0, width, height);

        const speed = mouse.x !== null ? Math.hypot(mouse.x - mouse.lastX, mouse.y - mouse.lastY) : 0;

        particles.forEach(p => {
            // Physics
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            p.vx += dx * 0.01;
            p.vy += dy * 0.01;
            p.vx *= 0.92;
            p.vy *= 0.92;

            // Mouse Interaction
            if (mouse.x !== null) {
                const mdx = mouse.x - p.x;
                const mdy = mouse.y - p.y;
                const dist = Math.sqrt(mdx * mdx + mdy * mdy);

                if (dist < 100 && speed > 1) {
                    const force = (100 - dist) / 100;
                    const angle = Math.atan2(mdy, mdx);
                    p.vx -= Math.cos(angle) * force * speed * 0.3;
                    p.vy -= Math.sin(angle) * force * speed * 0.3;
                }
            }

            if (p.isNoise) {
                p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y) * 0.3;
            } else {
                p.x += p.vx;
            }
            p.y += p.vy;

            // Draw
            contentCtx.beginPath();
            contentCtx.fillStyle = p.color;
            contentCtx.globalAlpha = p.isNoise ? 0.4 : 1.0;
            contentCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            contentCtx.fill();
        });
        
        contentCtx.globalAlpha = 1;
        state.hero.mouse.lastX = state.hero.mouse.x;
        state.hero.mouse.lastY = state.hero.mouse.y;

        const elapsed = ((Date.now() - state.hero.startTime) / 1000).toFixed(2);
        document.getElementById('inference').innerText = `${elapsed}s`;
    }
}




/* =========================================
   SECTION 2: MODEL CARD LOGIC
   ========================================= */

function initModelCard() {
    const d = state.data.about;
    if(!d) return;

    // 1. Populate Profile Text
    document.getElementById('model-name').innerText = d.profile.name;
    document.getElementById('model-title').innerText = d.profile.title;
    document.getElementById('model-desc').innerHTML = d.profile.description;

    const badgeContainer = document.getElementById('model-badges');
    badgeContainer.innerHTML = '';
    
    // Add Role Badges
    d.profile.roles.forEach(role => {
        const span = document.createElement('span');
        span.className = 'badge';
        span.innerText = role;
        badgeContainer.appendChild(span);
    });
    
    // Add Link Badge
    const link = document.createElement('a');
    link.href = d.profile.link_url;
    link.target = '_blank';
    link.style.textDecoration = 'none';
    link.innerHTML = `<span class="badge outline" style="cursor: pointer;">${d.profile.link_text}</span>`;
    badgeContainer.appendChild(link);

    // 2. Build Heatmap
    const grid = document.getElementById('attention-map');
    const readout = document.getElementById('skill-readout');
    grid.innerHTML = ''; // Clear existing
    state.modelCard.cells = [];

    d.skills.forEach(skill => {
        const cell = document.createElement('div');
        cell.className = 'heat-cell';
        const opacity = 0.3 + (skill.weight * 0.7);
        cell.style.backgroundColor = `rgba(251, 191, 36, ${opacity})`;
        cell.style.setProperty('--opacity', skill.weight);

        cell.addEventListener('mouseenter', () => {
            readout.innerHTML = `
                <span class="skill-name">${skill.name.toUpperCase()}</span>
                <span class="skill-score">[CONFIDENCE: ${(skill.weight * 100).toFixed(0)}%]</span>
            `;
            cell.style.borderColor = '#fff';
            cell.style.transform = 'scale(1.2)';
            cell.style.zIndex = '10';
            cell.style.boxShadow = '0 0 15px var(--accent)';
        });

        cell.addEventListener('mouseleave', () => {
            readout.innerHTML = `<span class="prompt-blink">[ WAITING FOR INPUT ]</span>`;
            cell.style.borderColor = '';
            cell.style.transform = '';
            cell.style.zIndex = '';
            cell.style.boxShadow = '';
        });

        grid.appendChild(cell);
        state.modelCard.cells.push(cell);
    });

    // 3. Prepare JSON String for Typewriter
    // Dynamic Age Logic
    const birthDate = new Date(d.birth_date);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) {
        age--;
    }
    const version = `v${age}.${now.getMonth() + 1}`;

    // Construct the object to display
    const configObj = {
        "model_name": `Naveen_LLM_${version}`,
        ...d.config_display,
        "training_time": "CALCULATING_EPOCHS..." 
    };
    
    state.modelCard.jsonString = JSON.stringify(configObj, null, 4);
    
    // Start radar scan loop immediately (it's passive)
    startRadarScan();
}

function startRadarScan() {
    if(state.modelCard.scanInterval) clearInterval(state.modelCard.scanInterval);
    
    function scan() {
        if(state.modelCard.cells.length === 0) return;
        const count = 3;
        for(let i=0; i<count; i++) {
            setTimeout(() => {
                const idx = Math.floor(Math.random() * state.modelCard.cells.length);
                const cell = state.modelCard.cells[idx];
                if(cell) {
                    cell.classList.add('scanning');
                    setTimeout(() => cell.classList.remove('scanning'), 600);
                }
            }, i * 100);
        }
        state.modelCard.scanInterval = setTimeout(scan, Math.random() * 3000 + 3000);
    }
    scan();
}

// --- ANIMATION CONTROLLERS ---

function startModelCardAnimation() {
    if(state.modelCard.isStreaming) return; // Already running
    state.modelCard.isStreaming = true;
    
    // Reveal Visual Blocks Staggered
    const blocks = ['block-profile', 'block-heatmap', 'block-pipeline'];
    blocks.forEach((id, idx) => {
        const el = document.getElementById(id);
        if(el) {
            setTimeout(() => el.classList.add('visible'), idx * 200);
        }
    });

    // Start Typewriter
    typeWriterLoop();
}

function resetModelCardAnimation() {
    state.modelCard.isStreaming = false;
    state.modelCard.charIndex = 0;
    
    // Clear Code View
    document.getElementById('json-stream').innerHTML = '';
    document.getElementById('line-numbers').innerHTML = '';
    document.getElementById('cursor').style.display = 'inline-block';
    
    // Stop Live Timer if running
    if(state.modelCard.timerInterval) clearInterval(state.modelCard.timerInterval);

    // Hide Visual Blocks
    const blocks = ['block-profile', 'block-heatmap', 'block-pipeline'];
    blocks.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('visible');
    });
}

function typeWriterLoop() {
    if (!state.modelCard.isStreaming) return; // Stop if user scrolled away

    const { jsonString, charIndex } = state.modelCard;
    const codeEl = document.getElementById('json-stream');
    const lineEl = document.getElementById('line-numbers');

    if (charIndex < jsonString.length) {
        const chunkSize = Math.floor(Math.random() * 4) + 1; // Random typing speed
        const currentText = jsonString.substring(0, charIndex + chunkSize);
        
        // Colorize syntax
        codeEl.innerHTML = currentText.replace(/"([^"]+)":|("[^"]+")/g, (match, key, str) => {
            if (key) return `<span class="key">"${key}"</span>:`;
            if (str) return `<span class="string">${str}</span>`;
            return match;
        })
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
        .replace(/[\[\]\{\}]/g, '<span class="bracket">$&</span>');

        // Update Line Numbers
        const lines = currentText.split('\n').length;
        lineEl.innerHTML = Array(lines).fill(0).map((_, i) => i + 1).join('<br>');
        
        state.modelCard.charIndex += chunkSize;
        
        // Auto Scroll
        const container = document.querySelector('.code-content');
        if(container) container.scrollTop = container.scrollHeight;

        setTimeout(typeWriterLoop, 10);
    } else {
        // Finished Typing -> Start Live Timer
        document.getElementById('cursor').style.display = 'none'; // hide cursor or keep blinking
        startLiveTimer();
    }
}

function startLiveTimer() {
    const birthDate = new Date(state.data.about.birth_date);
    
    // Find the specific span in the generated HTML
    const spans = document.querySelectorAll('#json-stream .string');
    let targetSpan = null;
    spans.forEach(span => {
        if (span.innerText.includes("CALCULATING_EPOCHS")) targetSpan = span;
    });

    if(targetSpan) {
        state.modelCard.timerInterval = setInterval(() => {
            if(!state.modelCard.isStreaming) return;
            const now = new Date();
            const diff = Math.floor((now - birthDate) / 1000).toLocaleString();
            targetSpan.innerHTML = `"${diff}s <span style='color:var(--accent)'>(LIVE)</span>"`;
        }, 1000);
    }
}



/* =========================================
   SECTION 3: TRAINING DASHBOARD LOGIC (UPDATED)
   ========================================= */

// Logical dimensions for the graph (Scales via CSS automatically)
const GRAPH_LOGIC_WIDTH = 800;
const GRAPH_LOGIC_HEIGHT = 400;
const GRAPH_PADDING_BOTTOM = 40;

function initTrainingSection() {
    if(!state.data || !state.data.education) return;
    
    // 1. Build Terminal Rows
    const container = document.getElementById('terminal-rows');
    container.innerHTML = '';
    state.data.education.epochs.forEach(epoch => {
        const row = document.createElement('div');
        row.className = 'epoch-row'; 
        
        let descHTML = `<p class="description">${epoch.desc}</p>`;
        if(epoch.active) {
            descHTML = `<p class="description"><span class="status-blink">>> FINE_TUNING...</span> ${epoch.desc.replace('>> FINE_TUNING... ', '')}</p>`;
        }

        row.innerHTML = `
            <div class="epoch-label">EPOCH ${epoch.id} [${epoch.label}]</div>
            <div class="progress-track">
                <div class="progress-fill ${epoch.active ? 'striped' : ''}"></div>
            </div>
            <div class="metrics">loss: <span class="val loss-val">${epoch.loss}</span> acc: <span class="val acc-val">${epoch.acc}</span></div>
            <div class="log-details">
                <h4 class="degree-name">${epoch.degree}</h4>
                <span class="year">${epoch.year}</span>
                ${descHTML}
            </div>
        `;
        container.appendChild(row);
    });

    // 2. Prepare Graph Data
    // We generate the shape ONCE so the "noise" doesn't jitter on resize
    state.training.zones = state.data.education.graph_zones;
    generateBaseData(); 

    // 3. Initial Render
    renderTrainingGraph();
    
    // NOTE: Resize listener removed to prevent graph disappearing.
    // The SVG viewBox handles scaling automatically.
}

// --- MATH & DATA GENERATION ---
function generateBaseData() {
    state.training.baseData = [];
    const zones = state.training.zones;
    const totalZones = zones.length;
    const zoneWidth = GRAPH_LOGIC_WIDTH / totalZones;
    const stepsPerZone = 12; // Resolution of curve

    zones.forEach((zone, zIndex) => {
        for (let i = 0; i < stepsPerZone; i++) {
            // X Position
            const zoneStartX = zIndex * zoneWidth;
            const relativeX = (i / stepsPerZone) * zoneWidth;
            const x = zoneStartX + relativeX;

            // Y Calculation
            const progress = i / stepsPerZone;
            
            // Base descent curve
            let baseLoss = zone.startLoss - ((zone.startLoss - zone.endLoss) * Math.pow(progress, 0.8));
            
            // Volatility (Sine wave + Noise)
            const frequency = 2.5; 
            const sineWave = Math.sin(progress * Math.PI * frequency) * zone.volatility;
            const microNoise = (Math.random() - 0.5) * (zone.volatility * 0.2);

            let finalLoss = Math.max(0.01, Math.min(0.99, baseLoss + sineWave + microNoise));

            state.training.baseData.push({
                x: x,
                y: (1 - finalLoss) * GRAPH_LOGIC_HEIGHT, // Invert for SVG Y-axis
                loss: finalLoss,
                zone: zone
            });
        }
    });
    
    // Add final point to close the gap
    const lastZone = zones[zones.length-1];
    state.training.baseData.push({
        x: GRAPH_LOGIC_WIDTH, 
        y: (1 - lastZone.endLoss) * GRAPH_LOGIC_HEIGHT, 
        loss: lastZone.endLoss,
        zone: lastZone
    });
}

function renderTrainingGraph() {
    const container = document.getElementById('lossChartContainer');
    const svgLayer = document.getElementById('svg-layer');
    if(!container || !svgLayer) return;

    const data = state.training.baseData;
    const zones = state.training.zones;
    const internalHeight = GRAPH_LOGIC_HEIGHT + GRAPH_PADDING_BOTTOM;

    // SVG Defs (Gradient)
    const defs = `
    <defs>
        <linearGradient id="gradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
        </linearGradient>
    </defs>`;

    // Build SVG String with viewBox for scaling
    let svgHTML = `<svg viewBox="0 0 ${GRAPH_LOGIC_WIDTH} ${internalHeight}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">${defs}`;
    
    // Render Grid Lines & Labels
    const zoneWidth = GRAPH_LOGIC_WIDTH / zones.length;
    zones.forEach((zone, index) => {
        const xPos = index * zoneWidth;
        // Grid Line
        svgHTML += `<line x1="${xPos}" y1="0" x2="${xPos}" y2="${GRAPH_LOGIC_HEIGHT}" class="grid-line" opacity="0.1" />`;
        // Label
        svgHTML += `<text x="${xPos + (zoneWidth/2)}" y="${GRAPH_LOGIC_HEIGHT + 25}" class="axis-label" fill="#666" font-size="12" text-anchor="middle" font-family="monospace" font-weight="bold">${zone.label}</text>`;
    });

    // Generate Smooth Path (Bezier)
    let pathD = `M ${data[0].x},${data[0].y} `;
    for(let i = 1; i < data.length; i++) {
        const cp1x = data[i-1].x + (data[i].x - data[i-1].x) / 2;
        pathD += `C ${cp1x},${data[i-1].y} ${cp1x},${data[i].y} ${data[i].x},${data[i].y} `;
    }

    const areaD = pathD + `L ${GRAPH_LOGIC_WIDTH},${GRAPH_LOGIC_HEIGHT} L 0,${GRAPH_LOGIC_HEIGHT} Z`;

    // Append Paths (Area + Line)
    svgHTML += `<path d="${areaD}" class="area-fill" id="graph-area" fill="url(#gradientFill)" opacity="0" />`;
    svgHTML += `<path d="${pathD}" class="graph-line" id="graph-stroke" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="2000" stroke-dashoffset="2000" />`;
    svgHTML += `</svg>`;

    svgLayer.innerHTML = svgHTML;

    // Setup Interaction Logic
    setupGraphInteraction(container, data);
}

function setupGraphInteraction(container, data) {
    const tooltip = document.getElementById('tooltip');
    const cursorLine = document.getElementById('cursor-line');
    const cursorDot = document.getElementById('cursor-dot');
    const hoverHint = document.getElementById('hover-hint');
    const ttGained = document.getElementById('tt-gained');
    const ttLost = document.getElementById('tt-lost');

    // Remove old listeners to prevent stacking
    container.onmousemove = null;
    container.onmouseleave = null;

    container.onmousemove = (e) => {
        if(hoverHint) hoverHint.classList.add('hidden');

        const rect = container.getBoundingClientRect();
        const relX = e.clientX - rect.left;

        // 1. Move Cursor Line (Visual only)
        cursorLine.style.display = 'block';
        cursorLine.style.left = `${relX}px`;

        // 2. Map pixel X to Logical SVG X (0-800)
        const svgX = (relX / rect.width) * GRAPH_LOGIC_WIDTH;

        // 3. Find closest data point
        const closest = data.reduce((prev, curr) => 
            Math.abs(curr.x - svgX) < Math.abs(prev.x - svgX) ? curr : prev
        );

        if (closest) {
            // 4. Map Logical Y back to Pixel Y for the Dot
            // Note: Use (GRAPH_LOGIC_HEIGHT + PADDING) as divisor to match SVG aspect ratio
            const internalHeight = GRAPH_LOGIC_HEIGHT + GRAPH_PADDING_BOTTOM;
            const pixelY = (closest.y / internalHeight) * rect.height;

            cursorDot.style.display = 'block';
            cursorDot.style.left = `${relX}px`;
            cursorDot.style.top = `${pixelY}px`;

            // 5. Update Tooltip Data
            tooltip.querySelector('.tt-header').innerHTML = `${closest.zone.label} <span style="float:right; opacity:0.5">LOSS: ${closest.loss.toFixed(3)}</span>`;
            ttGained.innerText = closest.zone.gained;
            ttLost.innerText = closest.zone.lost;

            // 6. Tooltip Positioning (Smart flip)
            let ttX = relX + 20;
            if (ttX + 240 > rect.width) ttX = relX - 250;
            
            tooltip.style.left = `${ttX}px`;
            tooltip.style.top = `${pixelY - 50}px`;
            tooltip.style.opacity = 1;
        }
    };

    container.onmouseleave = () => {
        cursorLine.style.display = 'none';
        cursorDot.style.display = 'none';
        tooltip.style.opacity = 0;
    };
}

// --- ANIMATION CONTROLLERS ---

function startTrainingAnimation() {
    // 1. Terminal Rows
    const rows = document.querySelectorAll('.epoch-row');
    rows.forEach((row, i) => {
        setTimeout(() => {
            row.classList.add('active');
            const fill = row.querySelector('.progress-fill');
            if(fill) fill.style.width = '100%';
        }, i * 200);
    });

    // 2. Graph Drawing (CSS Animation Trigger)
    const stroke = document.getElementById('graph-stroke');
    const area = document.getElementById('graph-area');
    if(stroke && area) {
        stroke.classList.remove('animate');
        area.classList.remove('animate');
        void stroke.offsetWidth; // Trigger Reflow
        stroke.classList.add('animate');
        area.classList.add('animate');
    }
}

function resetTrainingAnimation() {
    // 1. Reset Rows
    const rows = document.querySelectorAll('.epoch-row');
    rows.forEach(row => {
        row.classList.remove('active');
        const fill = row.querySelector('.progress-fill');
        if(fill) fill.style.width = '0%';
    });

    // 2. Reset Graph
    const stroke = document.getElementById('graph-stroke');
    const area = document.getElementById('graph-area');
    if(stroke && area) {
        stroke.classList.remove('animate');
        area.classList.remove('animate');
    }
}


/* =========================================
   SECTION 4: NEURAL PROJECTS LOGIC
   ========================================= */

function initNeuralSection() {
    if(!state.data.neural) return;
    const { layers, agents } = state.data.neural;
    const container = document.getElementById('neural-cols');
    container.innerHTML = '';

    // 1. Build Tech Layers
    layers.forEach((layer, index) => {
        const col = document.createElement('div');
        col.className = `layer-col delay-${index+1}`;
        
        // Header
        const header = document.createElement('div');
        header.className = 'col-header';
        header.innerText = layer.title;
        col.appendChild(header);

        // Nodes
        layer.nodes.forEach(node => {
            const el = document.createElement('div');
            el.className = 'tech-node';
            el.dataset.id = node.id;
            el.innerText = node.label;
            col.appendChild(el);
        });

        container.appendChild(col);
    });

    // 2. Build Agent Layer (The Last Column)
    const agentCol = document.createElement('div');
    agentCol.className = `layer-col project-col delay-${layers.length + 1}`;
    
    const agentHeader = document.createElement('div');
    agentHeader.className = 'col-header';
    agentHeader.innerText = "OUTPUT LAYER";
    agentCol.appendChild(agentHeader);

    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        if(agent.hasHint) card.classList.add('ux-hint-pulse');
        card.id = agent.id;
        
        // Hint Bubble
        let hintHTML = agent.hasHint ? `<div class="ux-hint-bubble">CLICK TO TRACE</div>` : '';
        
        card.innerHTML = `
            ${hintHTML}
            <div class="agent-header">
                <span class="agent-badge">${agent.badge}</span>
                <div class="status-dot"></div>
            </div>
            <h3>${agent.name}</h3>
            <p>${agent.desc}</p>
            <a href="${agent.link}" target="_blank" class="agent-link" onclick="event.stopPropagation()">
                > LAUNCH_SYSTEM ↗
            </a>
        `;

        // Click Handler (Dynamic)
        card.addEventListener('click', () => {
            handleAgentClick(agent.id, agent.path);
        });

        agentCol.appendChild(card);
    });

    container.appendChild(agentCol);

    // 3. Initialize Drawing Logic
    // We wait a moment for DOM layout, but actual drawing happens in the Observer/Resize logic
    state.neural.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(drawNeuralConnections);
    });
    state.neural.resizeObserver.observe(document.getElementById('graph-wrapper'));
}

// --- DRAWING LOGIC ---

function getRelCenter(el, wrapper) {
    const rect = el.getBoundingClientRect();
    const wrapRect = wrapper.getBoundingClientRect();
    return {
        x: rect.left - wrapRect.left + rect.width / 2,
        y: rect.top - wrapRect.top + rect.height / 2
    };
}

function drawNeuralConnections() {
    const svg = document.getElementById('project-connections');
    const wrapper = document.getElementById('graph-wrapper');
    if(!svg || !wrapper) return;

    // Reset
    svg.innerHTML = '';
    state.neural.archLines = [];

    const cols = document.querySelectorAll('.layer-col');
    if(cols.length === 0) return;

    // Sync SVG size
    const svgRect = wrapper.getBoundingClientRect();
    svg.setAttribute('width', svgRect.width);
    svg.setAttribute('height', svgRect.height);

    // Connect sequential layers
    for(let i = 0; i < cols.length - 1; i++) {
        const currentNodes = cols[i].querySelectorAll('.tech-node, .agent-card');
        const nextNodes = cols[i+1].querySelectorAll('.tech-node, .agent-card');

        currentNodes.forEach(startEl => {
            nextNodes.forEach(endEl => {
                // Only draw if elements have dimension (are visible)
                if(startEl.offsetWidth > 0 && endEl.offsetWidth > 0) {
                    createArchLine(startEl, endEl, svg, wrapper);
                }
            });
        });
    }

    // Re-highlight if an agent is active
    if(state.neural.activeAgentId) {
        const agent = state.data.neural.agents.find(a => a.id === state.neural.activeAgentId);
        if(agent) activatePathVisuals(agent.id, agent.path);
    }
}

function createArchLine(startEl, endEl, svg, wrapper) {
    const start = getRelCenter(startEl, wrapper);
    const end = getRelCenter(endEl, wrapper);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d = '';

    if(window.innerWidth > 768) {
        // Desktop: Curvy Bezier
        const dx = end.x - start.x;
        const cp1 = { x: start.x + dx * 0.5, y: start.y };
        const cp2 = { x: end.x - dx * 0.5, y: end.y };
        d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
    } else {
        // Mobile: S-Curve vertical
        const midY = (start.y + end.y) / 2;
        d = `M ${start.x} ${start.y} Q ${start.x} ${midY} ${(start.x + end.x)/2} ${midY} T ${end.x} ${end.y}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('class', 'arch-line');
    
    // Store IDs for activation logic
    const u1 = startEl.dataset.id || startEl.id;
    const u2 = endEl.dataset.id || endEl.id;
    
    svg.appendChild(path);
    state.neural.archLines.push({ el: path, u1, u2 });
}

// --- INTERACTION LOGIC ---

function handleAgentClick(agentId, pathIds) {
    // Remove hints on first click
    if (state.neural.isFirstClick) {
        const hint = document.querySelector('.ux-hint-bubble');
        const pulser = document.querySelector('.ux-hint-pulse');
        if(hint) hint.remove();
        if(pulser) pulser.classList.remove('ux-hint-pulse');
        state.neural.isFirstClick = false;
    }

    state.neural.activeAgentId = agentId;
    activatePathVisuals(agentId, pathIds);
}

function activatePathVisuals(agentId, pathIds) {
    // Reset classes
    document.querySelectorAll('.active-node').forEach(el => el.classList.remove('active-node'));
    document.querySelectorAll('.active-card').forEach(el => el.classList.remove('active-card'));
    document.querySelectorAll('.active-line').forEach(el => el.classList.remove('active-line'));

    // Highlight Agent
    document.getElementById(agentId).classList.add('active-card');

    // Highlight Nodes
    pathIds.forEach(id => {
        const node = document.querySelector(`[data-id="${id}"]`);
        if(node) node.classList.add('active-node');
    });

    // Highlight Lines (Check if line connects two active items)
    const activeSet = new Set([...pathIds, agentId]);
    const svg = document.getElementById('project-connections');

    state.neural.archLines.forEach(lineObj => {
        if(activeSet.has(lineObj.u1) && activeSet.has(lineObj.u2)) {
            lineObj.el.classList.add('active-line');
            // Move to end of SVG to draw on top
            svg.appendChild(lineObj.el);
        }
    });
}

// --- ANIMATION CONTROLLERS ---

function startNeuralAnimation() {
    document.getElementById('neural-header').classList.add('visible');
    const cols = document.querySelectorAll('.layer-col');
    cols.forEach(col => col.classList.add('visible'));
    
    // Force redraw to ensure lines match new positions
    setTimeout(drawNeuralConnections, 500); 
}

function resetNeuralAnimation() {
    document.getElementById('neural-header').classList.remove('visible');
    const cols = document.querySelectorAll('.layer-col');
    cols.forEach(col => col.classList.remove('visible'));
    // We don't clear active selection, but we hide the columns
}


/* =========================================
   SECTION 5: CONTACT IDE LOGIC
   ========================================= */

function initContactSection() {
    if(!state.data.contact) return;
    const d = state.data.contact;

    // 1. Set Placeholders & Filenames
    document.getElementById('file-name-display').innerText = d.filename;
    document.getElementById('tab-name-display').innerText = d.filename;
    
    document.getElementById('in-name').placeholder = d.placeholders.name;
    document.getElementById('in-email').placeholder = d.placeholders.email;
    document.getElementById('in-message').placeholder = d.placeholders.message;

    // 2. Build Sidebar (Network Interfaces)
    const netContainer = document.getElementById('network-interfaces');
    netContainer.innerHTML = '';
    
    // Email
    createNetItem(netContainer, 'PERSONAL_SMTP_UPLINK', d.email, 'green', () => copyToClip(d.email));
    // Phone
    createNetItem(netContainer, 'VOICE_GATEWAY', d.phone, 'yellow', () => copyToClip(d.phone));
    // Location (No Copy)
    createNetItem(netContainer, 'GEO_LOCATION', d.location, 'blue', null);

    // 3. Build Sidebar (Git Remotes)
    const gitContainer = document.getElementById('git-remotes');
    gitContainer.innerHTML = '';
    d.socials.forEach(social => {
        const link = document.createElement('a');
        link.href = social.link;
        link.target = '_blank';
        link.className = 'git-item';
        link.innerHTML = `<span class="branch-icon">${social.icon}</span> ${social.label}`;
        gitContainer.appendChild(link);
    });

    // 4. Bind Input Events for Live Code Update
    const inputs = ['in-name', 'in-email', 'in-intent', 'in-message'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateCodePreview);
    });
    
    // 5. Bind Run Button
    document.getElementById('run-script-btn').addEventListener('click', runContactScript);
}

function createNetItem(container, label, value, color, clickHandler) {
    const item = document.createElement('div');
    item.className = clickHandler ? 'net-interface' : 'net-interface no-hover';
    if(clickHandler) item.onclick = clickHandler;
    
    item.innerHTML = `
        <div class="net-status"><span class="led ${color}"></span> ${label}</div>
        <div class="net-value">${value}</div>
        ${clickHandler ? '<div class="net-copy">:: CLICK_TO_COPY</div>' : ''}
    `;
    container.appendChild(item);
}

function updateCodePreview() {
    const name = document.getElementById('in-name').value || "None";
    const email = document.getElementById('in-email').value || "None";
    const intent = document.getElementById('in-intent').value;
    const message = document.getElementById('in-message').value || "(Waiting for input...)";

    document.getElementById('code-name').innerText = `"${name}"`;
    document.getElementById('code-email').innerText = `"${email}"`;
    document.getElementById('code-intent').innerText = `af.Intent.${intent}`;
    
    // Preserve newlines in message
    document.getElementById('code-message').innerText = `"""\n        ${message}\n        """`;
}

function copyToClip(text) {
    navigator.clipboard.writeText(text);
    const term = document.getElementById('terminal-output');
    // Simulate system log in terminal
    term.innerHTML += `<br><span class="log-msg">> Copied to buffer: "${text}"</span>`;
    term.scrollTop = term.scrollHeight;
}

function runContactScript() {
    if(state.contact.isRunning) return;
    state.contact.isRunning = true;

    const term = document.getElementById('terminal-output');
    const btn = document.getElementById('run-script-btn');
    
    // 1. UI Feedback
    btn.style.background = '#fbbf24'; 
    btn.innerHTML = '⚡ RUNNING...';
    
    const lines = [
        '<br>> python3 contact_me.py',
        '> Compiling payload...',
        '> Importing dependencies [agent_factory, sys]... OK',
        '> Validating sender credentials... OK',
        '> Establishing secure handshake with Naveen.ai...',
        '> Transmitting packets...'
    ];

    let delay = 0;
    // Clear terminal line for clean run
    term.innerHTML = '<span class="path">user@naveen-portfolio:~/scripts$</span>';

    // 2. Line-by-line Typewriter effect
    lines.forEach((line) => {
        delay += Math.random() * 400 + 200;
        setTimeout(() => {
            term.innerHTML += `<span class="log-msg">${line}</span>`;
            term.scrollTop = term.scrollHeight;
        }, delay);
    });

    // 3. Completion
    setTimeout(() => {
        const id = Math.floor(Math.random()*9000)+1000;
        term.innerHTML += `<br><span class="success-msg">✔ SUCCESS: Message delivered to buffer [ID: ${id}].</span>`;
        term.innerHTML += `<span class="path">user@naveen-portfolio:~/scripts$</span> <span class="cursor-blink">_</span>`;
        term.scrollTop = term.scrollHeight;
        
        btn.style.background = '#4ade80';
        btn.innerHTML = '<span class="play-icon">▶</span> SCRIPT EXECUTED';
        
        // Reset Button and Form after delay
        setTimeout(() => {
            state.contact.isRunning = false;
            document.getElementById('ide-form').reset();
            updateCodePreview();
            btn.innerHTML = '<span class="play-icon">▶</span> RUN SCRIPT';
        }, 4000);
    }, delay + 800);
}

// --- ANIMATION CONTROLLERS ---

function startContactAnimation() {
    document.getElementById('ide-container').classList.add('visible');
}

function resetContactAnimation() {
    document.getElementById('ide-container').classList.remove('visible');
    
    // Reset Terminal Text to keep it fresh
    const term = document.getElementById('terminal-output');
    if(term) term.innerHTML = state.contact.defaultPrompt;
    
    // Reset Button state if user scrolled away mid-run
    state.contact.isRunning = false;
    const btn = document.getElementById('run-script-btn');
    if(btn) {
        btn.style.background = '#4ade80';
        btn.innerHTML = '<span class="play-icon">▶</span> RUN SCRIPT';
    }
}

/* =========================================
   FOOTER LOGIC (RESEARCH PAPER)
   ========================================= */
function initFooter() {
    if(!state.data || !state.data.footer) return;
    const d = state.data.footer;

    // 1. Static Text
    document.getElementById('f-title').innerText = d.title;
    document.getElementById('f-abstract').innerText = d.abstract;
    document.getElementById('f-meta').innerText = d.meta;
    document.getElementById('f-bibtex').innerText = d.bibtex;

    // 2. References List (Internal)
    const refContainer = document.getElementById('f-references');
    refContainer.innerHTML = '';
    d.references.forEach(ref => {
        const li = document.createElement('li');
        li.className = 'ref-item';
        li.innerHTML = `<span class="ref-id">${ref.id}</span> <a href="${ref.url}" class="ref-link">${ref.label}</a>`;
        refContainer.appendChild(li);
    });

    // 3. Connect List (External)
    const connContainer = document.getElementById('f-connect');
    connContainer.innerHTML = '';
    d.connect.forEach(conn => {
        const li = document.createElement('li');
        li.className = 'ref-item';
        li.innerHTML = `<span class="ref-id">${conn.id}</span> <a href="${conn.url}" target="_blank" class="ref-link">${conn.label}</a>`;
        connContainer.appendChild(li);
    });

    // 4. Copy Interaction
    const btn = document.getElementById('copy-bib-btn');
    btn.addEventListener('click', () => {
        navigator.clipboard.writeText(d.bibtex);
        btn.innerText = "COPIED";
        setTimeout(() => btn.innerText = "COPY", 2000);
    });
}