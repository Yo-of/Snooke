const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('scoreValue');
        const startScreen = document.getElementById('startScreen');
        const gameOverScreen = document.getElementById('gameOverScreen');
        const finalScoreElement = document.getElementById('finalScore');
        const statusEffectElement = document.getElementById('statusEffect');

        let tileSize, tileCount;
        let snake = [{x: 8, y: 8}];
        let food = {x: 12, y: 12};
        let dx = 1;
        let dy = 0;
        let score = 0;
        let gameLoop;
        let gameStarted = false;
        let lastRenderTime = 0;
        let SNAKE_SPEED = 10; // Moves per second
        let specialFood = null;
        let activeEffect = null;
        let effectDuration = 0;
        let portalPair = [];

        const EFFECTS = {
            FRENZY: { color: '#00f', duration: 5000, apply: () => SNAKE_SPEED = 20 },
            SLOW: { color: '#800080', duration: 5000, apply: () => SNAKE_SPEED = 5 },
            REVERSE: { color: '#ffa500', duration: 5000, apply: () => [dx, dy] = [-dx, -dy] },
            GROWTH: { color: '#ff69b4', duration: 0, apply: () => growSnake(3) }
        };

        // Audio context and sounds
        let audioContext;
        let sounds = {};

        function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create oscillator-based sounds
            sounds.eat = createBeepSound(600, 0.1);
            sounds.gameOver = createBeepSound(200, 0.3);
            sounds.start = createBeepSound(440, 0.2);
            sounds.specialFood = createBeepSound(800, 0.15);
            sounds.portal = createBeepSound(1000, 0.1);
        }

        function createBeepSound(frequency, duration) {
            return () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + duration);
            };
        }

        function playSound(sound) {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            sound();
        }

        function resizeGame() {
            const gameContainer = document.querySelector('.game-container');
            const containerWidth = gameContainer.clientWidth;
            const containerHeight = gameContainer.clientHeight;
            const size = Math.min(containerWidth, containerHeight);
            
            canvas.width = size;
            canvas.height = size;
            
            tileCount = 16;
            tileSize = size / tileCount;
        }

        function gameStep(currentTime) {
            if (gameStarted) {
                window.requestAnimationFrame(gameStep);

                const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
                if (secondsSinceLastRender < 1 / SNAKE_SPEED) return;

                lastRenderTime = currentTime;

                updateGame();
                draw();
            }
        }

        function updateGame() {
            moveSnake();
            checkCollision();
            updateEffects();
        }

        function moveSnake() {
            const head = {x: snake[0].x + dx, y: snake[0].y + dy};
            snake.unshift(head);

            if (head.x === food.x && head.y === food.y) {
                score++;
                scoreElement.textContent = score;
                playSound(sounds.eat);
                spawnFood();
            } else if (specialFood && head.x === specialFood.x && head.y === specialFood.y) {
                applyEffect(specialFood.effect);
                specialFood = null;
                score += 2;
                scoreElement.textContent = score;
                playSound(sounds.specialFood);
            } else {
                snake.pop();
            }

            // Check for portal teleportation
            if (portalPair.length === 2) {
                const [portal1, portal2] = portalPair;
                if (head.x === portal1.x && head.y === portal1.y) {
                    snake[0] = { x: portal2.x, y: portal2.y };
                    playSound(sounds.portal);
                } else if (head.x === portal2.x && head.y === portal2.y) {
                    snake[0] = { x: portal1.x, y: portal1.y };
                    playSound(sounds.portal);
                }
            }
        }

        function draw() {
            clearCanvas();
            drawFood();
            if (specialFood) drawSpecialFood();
            drawSnake();
            if (portalPair.length === 2) drawPortals();
        }

        function clearCanvas() {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        function drawFood() {
            ctx.fillStyle = '#ff0';
            ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);
        }

        function drawSpecialFood() {
            ctx.fillStyle = specialFood.effect.color;
            ctx.fillRect(specialFood.x * tileSize, specialFood.y * tileSize, tileSize, tileSize);
        }

        function drawSnake() {
            ctx.fillStyle = '#0f0';
            snake.forEach(segment => {
                ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize, tileSize);
            });
        }

        function drawPortals() {
            ctx.fillStyle = '#fff';
            portalPair.forEach(portal => {
                ctx.beginPath();
                ctx.arc((portal.x + 0.5) * tileSize, (portal.y + 0.5) * tileSize, tileSize / 2, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        function checkCollision() {
            const head = snake[0];
            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                gameOver();
            }
            for (let i = 1; i < snake.length; i++) {
                if (head.x === snake[i].x && head.y === snake[i].y) {
                    gameOver();
                }
            }
        }

        function spawnFood() {
            do {
                food.x = Math.floor(Math.random() * tileCount);
                food.y = Math.floor(Math.random() * tileCount);
            } while (isOnSnake(food));

            if (Math.random() < 0.2) { // 20% chance to spawn special food
                spawnSpecialFood();
            }

            if (Math.random() < 0.1 && portalPair.length === 0) { // 10% chance to spawn portals
                spawnPortals();
            }
        }

        function spawnSpecialFood() {
            const effects = Object.values(EFFECTS);
            const randomEffect = effects[Math.floor(Math.random() * effects.length)];
            do {
                specialFood = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount),
                    effect: randomEffect
                };
            } while (isOnSnake(specialFood) || (specialFood.x === food.x && specialFood.y === food.y));
        }

        function spawnPortals() {
            for (let i = 0; i < 2; i++) {
                let portal;
                do {
                    portal = {
                        x: Math.floor(Math.random() * tileCount),
                        y: Math.floor(Math.random() * tileCount)
                    };
                } while (isOnSnake(portal) || isOnFood(portal) || isOnSpecialFood(portal));
                portalPair.push(portal);
            }
        }

        function isOnSnake(pos) {
            return snake.some(segment => segment.x === pos.x && segment.y === pos.y);
        }

        function isOnFood(pos) {
            return pos.x === food.x && pos.y === food.y;
        }

        function isOnSpecialFood(pos) {
            return specialFood && pos.x === specialFood.x && pos.y === specialFood.y;
        }

        function applyEffect(effect) {
            activeEffect = effect;
            effectDuration = effect.duration;
            effect.apply();
            updateStatusEffect();
        }

        function updateEffects() {
            if (activeEffect && effectDuration > 0) {
                effectDuration -= 1000 / SNAKE_SPEED;
                if (effectDuration <= 0) {
                    SNAKE_SPEED = 10; // Reset to normal speed
                    activeEffect = null;
                    updateStatusEffect();
                }
            }
        }

        function updateStatusEffect() {
            if (activeEffect) {
                const effectName = Object.keys(EFFECTS).find(key => EFFECTS[key] === activeEffect);
                statusEffectElement.textContent = `${effectName} ACTIVE`;
                statusEffectElement.style.color = activeEffect.color;
            } else {
                statusEffectElement.textContent = '';
            }
        }

        function growSnake(amount) {
            for (let i = 0; i < amount; i++) {
                snake.push({...snake[snake.length - 1]});
            }
        }

        function gameOver() {
            gameStarted = false;
            finalScoreElement.textContent = score;
            gameOverScreen.style.display = 'block';
            playSound(sounds.gameOver);
        }

        function getRandomDarkColor() {
            const r = Math.floor(Math.random() * 128);
            const g = Math.floor(Math.random() * 128);
            const b = Math.floor(Math.random() * 128);
            return `rgb(${r}, ${g}, ${b})`;
        }

        function setBackgroundColor(color) {
            document.documentElement.style.setProperty('--bg-color', color);
        }

        function startGame() {
            snake = [{x: 8, y: 8}];
            dx = 1;
            dy = 0;
            score = 0;
            scoreElement.textContent = score;
            SNAKE_SPEED = 10;
            activeEffect = null;
            effectDuration = 0;
            specialFood = null;
            portalPair = [];
            setBackgroundColor(getRandomDarkColor());
            spawnFood();
            gameStarted = true;
            startScreen.style.display = 'none';
            gameOverScreen.style.display = 'none';
            statusEffectElement.textContent = '';
            lastRenderTime = 0;
            playSound(sounds.start);
            window.requestAnimationFrame(gameStep);
        }

        document.addEventListener('keydown', (e) => {
            if (!gameStarted && e.code === 'Space') {
                startGame();
            } else if (gameStarted) {
                switch (e.code) {
                    case 'ArrowUp':
                        if (dy === 0) { dx = 0; dy = -1; }
                        break;
                    case 'ArrowDown':
                        if (dy === 0) { dx = 0; dy = 1; }
                        break;
                    case 'ArrowLeft':
                        if (dx === 0) { dx = -1; dy = 0; }
                        break;
                    case 'ArrowRight':
                        if (dx === 0) { dx = 1; dy = 0; }
                        break;
                }
            }
        });

        window.addEventListener('resize', resizeGame);
        window.addEventListener('load', () => {
            initAudio();
            resizeGame();
        });