// Конфігурація
const CONFIG = {
    WOT_API_KEY: localStorage.getItem('wotApiKey') || "f5f97f92233a59f3d8dbaec28d22ce0f",
    WOT_API_URL: "https://api.worldoftanks.eu/wot"
};

// Глобальні змінні для зберігання стану
let currentPlayer = null;
let playerBattles = [];
let originalBattles = []; // Зберігаємо оригінальні дані для фільтрування

// DOM елементи
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const loadBattlesBtn = document.getElementById('load-battles-btn');
const openTomatoBtn = document.getElementById('open-tomato-btn');
const openWotBtn = document.getElementById('open-wot-btn');

// Ініціалізація додатку
function initApp() {
    // Встановлюємо значення поля API ключа
    document.getElementById('wot-api-key').value = CONFIG.WOT_API_KEY;
    
    // Додаємо обробники подій
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('search-player-btn').addEventListener('click', searchPlayer);
    document.getElementById('player-nickname').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPlayer();
        }
    });
    loadBattlesBtn.addEventListener('click', loadPlayerBattles);
    openTomatoBtn.addEventListener('click', openTomatoGGProfile);
    openWotBtn.addEventListener('click', openWotProfile);
    
    // Додаємо обробники для фільтрів
    document.getElementById('tank-type-filter').addEventListener('change', filterBattles);
    document.getElementById('tier-filter').addEventListener('change', filterBattles);
    
    // Додаємо обробники для ползунків
    const battlesRange = document.getElementById('battles-range');
    const battlesValue = document.getElementById('battles-value');
    battlesRange.addEventListener('input', function() {
        battlesValue.textContent = this.value;
    });
    
    const daysRange = document.getElementById('days-range');
    const daysValue = document.getElementById('days-value');
    daysRange.addEventListener('input', function() {
        daysValue.textContent = this.value;
    });
    
    // Ініціалізуємо обробники для сповіщень
    initNotifications();
}

// Ініціалізація обробників закриття сповіщень
function initNotifications() {
    // Додавання обробників подій для кнопок закриття
    const closeButtons = document.querySelectorAll('.alert-close');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            const alert = this.parentElement;
            hideMessage(alert);
        };
    });
}

// Збереження налаштувань
function saveSettings() {
    CONFIG.WOT_API_KEY = document.getElementById('wot-api-key').value.trim();
    localStorage.setItem('wotApiKey', CONFIG.WOT_API_KEY);
    
    showMessage('Налаштування успішно збережено', 'success');
}

// Очищення даних про попереднього гравця
function clearPreviousPlayerData() {
    // Очищаємо дані про бої
    playerBattles = [];
    originalBattles = [];
    
    // Ховаємо картку з боями, якщо вона відображається
    document.getElementById('battles-list-card').style.display = 'none';
    
    // Очищаємо список танків
    const tanksListDiv = document.getElementById('tanks-list');
    if (tanksListDiv) {
        tanksListDiv.innerHTML = '';
    }
    
    // Скидаємо загальну статистику
    document.getElementById('total-battles').textContent = '0';
    document.getElementById('avg-winrate').textContent = '0%';
    document.getElementById('avg-damage').textContent = '0';
    document.getElementById('avg-frags').textContent = '0';
}

// Пошук гравця
async function searchPlayer() {
    const nickname = document.getElementById('player-nickname').value.trim();
    const server = document.getElementById('server').value;
    
    if (!nickname) {
        showMessage('Введіть нікнейм гравця', 'error');
        return;
    }
    
    try {
        // Показуємо завантаження
        document.getElementById('player-nickname').disabled = true;
        document.getElementById('server').disabled = true;
        document.getElementById('search-player-btn').disabled = true;
        document.getElementById('search-player-btn').innerHTML = '<span class="material-icons">hourglass_empty</span>';
        
        // Очищаємо дані про попереднього гравця
        clearPreviousPlayerData();
        
        // Отримуємо дані про гравця
        const player = await getPlayerByNickname(nickname, server);
        
        if (!player) {
            showMessage(`Гравця з нікнеймом "${nickname}" не знайдено`, 'error');
            resetSearchForm();
            return;
        }
        
        // Зберігаємо дані гравця
        currentPlayer = {
            id: player.account_id,
            nickname: player.nickname,
            server: server
        };
        
        // Отримуємо детальну інформацію про гравця
        const playerDetails = await getPlayerDetails(player.account_id, server);
        
        if (playerDetails) {
            currentPlayer.details = playerDetails;
        }
        
        // Відображаємо інформацію про гравця
        displayPlayerInfo();
        
        // Активуємо кнопки дій
        loadBattlesBtn.disabled = false;
        openTomatoBtn.disabled = false;
        openWotBtn.disabled = false;
        
        // Показуємо картку з інформацією про гравця
        document.getElementById('player-info-card').style.display = 'block';
        
        showMessage(`Гравця "${player.nickname}" знайдено`, 'success');
    } catch (error) {
        console.error('Помилка пошуку гравця:', error);
        showMessage('Помилка: ' + error.message, 'error');
    } finally {
        resetSearchForm();
    }
}

// Відновлення форми пошуку
function resetSearchForm() {
    document.getElementById('player-nickname').disabled = false;
    document.getElementById('server').disabled = false;
    document.getElementById('search-player-btn').disabled = false;
    document.getElementById('search-player-btn').innerHTML = '<span class="material-icons">search</span>';
}

// Отримання даних гравця за нікнеймом
async function getPlayerByNickname(nickname, server = 'EU') {
    try {
        // Вибираємо правильний домен API в залежності від сервера
        let apiDomain = "https://api.worldoftanks.eu/wot";
        
        switch(server) {
            case "NA":
                apiDomain = "https://api.worldoftanks.com/wot";
                break;
            case "ASIA":
                apiDomain = "https://api.worldoftanks.asia/wot";
                break;
        }
        
        const url = `${apiDomain}/account/list/?application_id=${CONFIG.WOT_API_KEY}&search=${encodeURIComponent(nickname)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'ok' && data.data && data.data.length > 0) {
            const exactMatch = data.data.find(player => 
                player.nickname.toLowerCase() === nickname.toLowerCase()
            );
            
            return exactMatch || data.data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Помилка отримання даних гравця:', error);
        throw new Error('Не вдалося отримати дані гравця');
    }
}

// Отримання детальної інформації про гравця
async function getPlayerDetails(accountId, server = 'EU') {
    try {
        // Вибираємо правильний домен API в залежності від сервера
        let apiDomain = "https://api.worldoftanks.eu/wot";
        
        switch(server) {
            case "NA":
                apiDomain = "https://api.worldoftanks.com/wot";
                break;
            case "ASIA":
                apiDomain = "https://api.worldoftanks.asia/wot";
                break;
        }
        
        const url = `${apiDomain}/account/info/?application_id=${CONFIG.WOT_API_KEY}&account_id=${accountId}&fields=statistics.all,global_rating,clan_id,last_battle_time`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'ok' && data.data && data.data[accountId]) {
            // Якщо є clan_id, запитаємо дані про клан
            const playerData = data.data[accountId];
            
            if (playerData.clan_id) {
                try {
                    const clanData = await getClanInfo(playerData.clan_id, server);
                    if (clanData) {
                        playerData.clan = clanData;
                    }
                } catch (e) {
                    console.error('Помилка отримання інформації про клан:', e);
                }
            }
            
            return playerData;
        }
        
        return null;
    } catch (error) {
        console.error('Помилка отримання детальної інформації про гравця:', error);
        return null;
    }
}

// Отримання інформації про клан
async function getClanInfo(clanId, server = 'EU') {
    try {
        // Вибираємо правильний домен API в залежності від сервера
        let apiDomain = "https://api.worldoftanks.eu/wot";
        
        switch(server) {
            case "NA":
                apiDomain = "https://api.worldoftanks.com/wot";
                break;
            case "ASIA":
                apiDomain = "https://api.worldoftanks.asia/wot";
                break;
        }
        
        // Розширимо поля запиту, щоб отримати всі розміри емблем
        const url = `${apiDomain}/clans/info/?application_id=${CONFIG.WOT_API_KEY}&clan_id=${clanId}&fields=tag,name,emblems.x24,emblems.x32,emblems.x64,emblems.x195,emblems.x256`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'ok' && data.data && data.data[clanId]) {
            return data.data[clanId];
        }
        
        return null;
    } catch (error) {
        console.error('Помилка отримання інформації про клан:', error);
        return null;
    }
}

// Відображення детальної інформації про гравця
function displayPlayerInfo() {
    if (!currentPlayer) return;
    
    const playerInfoDiv = document.getElementById('player-info');
    let html = '<div class="player-info-container">';
    
    // Основна інформація про гравця
    html += '<div class="player-info-main">';
    
    // Аватар (з клану або перша літера нікнейму)
    html += '<div class="player-avatar">';
    if (currentPlayer.details && currentPlayer.details.clan) {
        // Якщо гравець у клані, використовуємо емблему клану
        if (currentPlayer.details.clan.emblems && currentPlayer.details.clan.emblems.x195) {
            html += `<img src="${currentPlayer.details.clan.emblems.x195.portal}" alt="Клановий аватар">`;
        } else {
            html += `<div class="avatar-placeholder">${currentPlayer.nickname.charAt(0).toUpperCase()}</div>`;
        }
    } else {
        // Якщо гравець не в клані, відображаємо першу літеру нікнейму
        html += `<div class="avatar-placeholder">${currentPlayer.nickname.charAt(0).toUpperCase()}</div>`;
    }
    html += '</div>';
    
    html += '<div class="player-details">';
    html += `<div class="player-name">${currentPlayer.nickname}</div>`;
    
    // Клан (якщо є)
    if (currentPlayer.details && currentPlayer.details.clan) {
        html += `<div class="player-clan">[${currentPlayer.details.clan.tag}] ${currentPlayer.details.clan.name}</div>`;
    }
    
    // Останній бій
    if (currentPlayer.details && currentPlayer.details.last_battle_time) {
        const lastBattleTime = new Date(currentPlayer.details.last_battle_time * 1000);
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        html += `<div class="player-last-battle">Останній бій: ${lastBattleTime.toLocaleDateString('uk-UA', dateOptions)}</div>`;
    }
    
    html += '</div>'; // player-details
    html += '</div>'; // player-info-main
    
    // Статистика гравця
    if (currentPlayer.details && currentPlayer.details.statistics && currentPlayer.details.statistics.all) {
        const stats = currentPlayer.details.statistics.all;
        
        html += '<div class="player-info-stats">';
        html += '<div class="player-stats-grid">';
        
        // Основні показники
        html += createStatCard('Бої', stats.battles.toLocaleString());
        html += createStatCard('Перемоги', `${(stats.wins / stats.battles * 100).toFixed(2)}%`);
        html += createStatCard('Середній дамаг', (stats.damage_dealt / stats.battles).toFixed(0));
        html += createStatCard('Середній фраг', (stats.frags / stats.battles).toFixed(2));
        html += createStatCard('Виявлення', (stats.spotted / stats.battles).toFixed(2));
        html += createStatCard('Захист', (stats.dropped_capture_points / stats.battles).toFixed(1));
        
        html += '</div>'; // player-stats-grid
        html += '</div>'; // player-info-stats
    }
    
    html += '</div>'; // player-info-container
    
    playerInfoDiv.innerHTML = html;
    
    // Додаємо стилі для заглушки аватару
    const style = document.createElement('style');
    if (!document.querySelector('#avatar-styles')) {
        style.id = 'avatar-styles';
        style.textContent = `
            .avatar-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--primary);
                color: white;
                font-size: 36px;
                font-weight: bold;
                border-radius: var(--border-radius);
            }
            .player-mini-avatar .avatar-placeholder {
                font-size: 18px;
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);
    }
}

// Створення картки статистики
function createStatCard(label, value) {
    return `
    <div class="stat-card">
        <div class="stat-info">
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    </div>
    `;
}

// Завантаження останніх боїв гравця з Tomato.gg
async function loadPlayerBattles() {
    if (!currentPlayer) {
        showMessage('Спочатку знайдіть гравця', 'error');
        return;
    }
    
    // Отримуємо параметри запиту
    const battles = document.getElementById('battles-range').value;
    const days = document.getElementById('days-range').value;
    
    // Показуємо індикатор завантаження
    document.getElementById('battles-list-card').style.display = 'block';
    document.getElementById('loader-container').style.display = 'flex';
    document.getElementById('tanks-list').style.display = 'none';
    document.getElementById('stats-summary').style.display = 'none';
    
    // Оновлюємо текст завантаження
    document.getElementById('battles-loading-text').textContent = 
        `Завантаження боїв гравця ${currentPlayer.nickname} (${currentPlayer.server})...`;
    
    try {
        // Деактивуємо кнопку завантаження
        loadBattlesBtn.disabled = true;
        loadBattlesBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Завантаження...';
        
        // Завантажуємо бої з Tomato.gg
        const battlesList = await getPlayerRecentBattlesFromTomato(
            currentPlayer.id, 
            currentPlayer.server, 
            document.getElementById('days-range').value,
            document.getElementById('battles-range').value
        );
        
        // Зберігаємо бої
        playerBattles = battlesList;
        originalBattles = [...battlesList]; // Копіюємо для фільтрації
        
        // Відображаємо бої
        displayPlayerBattles(battlesList);
        
        showMessage(`Завантажено статистику за ${document.getElementById('days-range').value} днів`, 'success');
    } catch (error) {
        console.error('Помилка завантаження боїв:', error);
        
        // Показуємо повідомлення про помилку
        const tanksListDiv = document.getElementById('tanks-list');
        tanksListDiv.style.display = 'block';
        tanksListDiv.innerHTML = `
            <div class="error-container">
                <div class="error-icon"><span class="material-icons">error_outline</span></div>
                <div class="error-message">Помилка завантаження даних</div>
                <div class="error-description">${error.message}</div>
                <div class="error-help">
                    Спробуйте оновити сторінку або перевірте підключення до інтернету.
                    Також можливо, що сервіс Tomato.gg тимчасово недоступний.
                </div>
            </div>
        `;
        
        document.getElementById('stats-summary').style.display = 'none';
        document.getElementById('loader-container').style.display = 'none';
        
        showMessage('Помилка завантаження боїв: ' + error.message, 'error');
    } finally {
        // Відновлюємо кнопку завантаження
        loadBattlesBtn.disabled = false;
        loadBattlesBtn.innerHTML = '<span class="material-icons">download</span> Завантажити бої';
    }
}

// Отримання останніх боїв з Tomato.gg
async function getPlayerRecentBattlesFromTomato(accountId, server = 'EU', days = 3, battlesLimit = 100) {
    try {
        // Будуємо оновлений URL для API Tomato.gg
        // Використовуємо прямий URL до боїв гравця замість recents
        const url = `https://api.tomato.gg/dev/api-v2/player/battles/${accountId}?page=0&days=${days}&battleType=random&pageSize=${battlesLimit}&sortBy=battle_time&sortDirection=desc&platoon=in-and-outside-platoon&spawn=all&won=all&classes=false,false,false,false,false&nations=false,false,false,false,false,false,false,false,false,false,false&tiers=false,false,false,false,false,false,false,false,false,false&tankType=all`;
        
        console.log(`Запит до Tomato.gg API: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP помилка: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log(`Отримано відповідь від Tomato.gg API:`, data.meta);
        
        if (!data.data || data.data.length === 0) {
            throw new Error('Немає даних про бої');
        }
        
        // Обробка отриманих даних боїв
        const battles = data.data;
        
        // Групуємо бої за танками
        const tanksMap = new Map();
        
        battles.forEach(battle => {
            const tankId = battle.id;
            const tankName = battle.name || 'Невідомий танк';
            const tankType = battle.type || 'unknown';
            const tier = battle.tier || 0;
            
            const key = `${tankName}_${tankType}_${tier}`;
            
            if (tanksMap.has(key)) {
                const existingBattle = tanksMap.get(key);
                
                // Оновлюємо статистику
                existingBattle.battles += 1;
                existingBattle.damage += battle.damage || 0;
                existingBattle.frags += battle.frags || 0;
                
                // Розрахування winrate
                if (battle.won) {
                    existingBattle.wins += 1;
                }
                
                // Оновлюємо середні показники
                existingBattle.winrate = (existingBattle.wins / existingBattle.battles) * 100;
                existingBattle.dpg = existingBattle.damage / existingBattle.battles;
                existingBattle.kpg = existingBattle.frags / existingBattle.battles;
            } else {
                tanksMap.set(key, {
                    tank: tankName,
                    tankType: tankType,
                    tier: tier,
                    damage: battle.damage || 0,
                    frags: battle.frags || 0,
                    battles: 1,
                    wins: battle.won ? 1 : 0,
                    winrate: battle.won ? 100 : 0,
                    dpg: battle.damage || 0,
                    kpg: battle.frags || 0
                });
            }
        });
        
        console.log(`Згруповано ${tanksMap.size} унікальних танків`);
        
        return Array.from(tanksMap.values());
    } catch (error) {
        console.error('Помилка завантаження боїв:', error);
        throw new Error(`Не вдалося завантажити бої з Tomato.gg: ${error.message}`);
    }
}

// Відображення боїв гравця
function displayPlayerBattles(battles) {
    // Ховаємо індикатор завантаження
    document.getElementById('loader-container').style.display = 'none';
    document.getElementById('tanks-list').style.display = 'grid';
    document.getElementById('stats-summary').style.display = 'block';
    
    const tanksListDiv = document.getElementById('tanks-list');
    
    if (battles.length === 0) {
        tanksListDiv.innerHTML = '<div class="loading-text">Немає даних про останні бої</div>';
        
        // Очищаємо статистику
        document.getElementById('total-battles').textContent = '0';
        document.getElementById('avg-winrate').textContent = '0%';
        document.getElementById('avg-damage').textContent = '0';
        document.getElementById('avg-frags').textContent = '0';
        
        return;
    }
    
    let html = '';
    
    // Розраховуємо сумарну статистику
    let totalBattles = 0;
    let totalDamage = 0;
    let weightedWinrate = 0;
    let totalFrags = 0;
    
    // Сортуємо танки за кількістю боїв (від більшого до меншого)
    battles.sort((a, b) => b.battles - a.battles);
    
    battles.forEach(battle => {
        // Оновлюємо сумарну статистику
        totalBattles += battle.battles;
        totalDamage += battle.damage;
        weightedWinrate += battle.winrate * battle.battles; // Зважене середнє
        totalFrags += battle.frags;
        
        // Визначаємо колір відсотка перемог
        let winrateColor = getWinrateColor(battle.winrate);
        
        // Додаємо картку для танка
        html += `
        <div class="tank-card">
            <div class="tank-header">
                <div class="tank-name">${battle.tank}</div>
                <div class="tank-tier">${battle.tier} рівень</div>
            </div>
            <div class="tank-type">${getTankTypeLabel(battle.tankType)}</div>
            
            <div class="tank-stats">
                <div class="tank-stat-item">
                    <div class="tank-stat-value">${battle.battles}</div>
                    <div class="tank-stat-label">Боїв</div>
                </div>
                <div class="tank-stat-item">
                    <div class="tank-stat-value" style="color: ${winrateColor};">${battle.winrate.toFixed(2)}%</div>
                    <div class="tank-stat-label">Перемоги</div>
                </div>
                <div class="tank-stat-item">
                    <div class="tank-stat-value">${battle.dpg.toFixed(0)}</div>
                    <div class="tank-stat-label">Сер. дамаг</div>
                </div>
                <div class="tank-stat-item">
                    <div class="tank-stat-value">${battle.kpg.toFixed(2)}</div>
                    <div class="tank-stat-label">Сер. фраги</div>
                </div>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${battle.winrate}%; background-color: ${winrateColor};"></div>
            </div>
        </div>
        `;
    });
    
    tanksListDiv.innerHTML = html;
    
    // Оновлюємо сумарну статистику
    const avgWinrate = weightedWinrate / totalBattles;
    const avgDamage = totalDamage / totalBattles;
    const avgFrags = totalFrags / totalBattles;
    
    document.getElementById('total-battles').textContent = totalBattles.toLocaleString();
    document.getElementById('avg-winrate').textContent = avgWinrate.toFixed(2) + '%';
    document.getElementById('avg-damage').textContent = avgDamage.toFixed(0);
    document.getElementById('avg-frags').textContent = avgFrags.toFixed(2);
    
    // Встановлюємо колір відсотка перемог
    document.getElementById('avg-winrate').style.color = getWinrateColor(avgWinrate);
}

// Функція для фільтрації боїв
function filterBattles() {
    if (!originalBattles || originalBattles.length === 0) return;
    
    const tankType = document.getElementById('tank-type-filter').value;
    const tier = document.getElementById('tier-filter').value;
    
    // Клонуємо оригінальні бої
    let filteredBattles = [...originalBattles];
    
    // Фільтруємо за типом танка
    if (tankType !== 'all') {
        filteredBattles = filteredBattles.filter(battle => battle.tankType === tankType);
    }
    
    // Фільтруємо за рівнем
    if (tier !== 'all') {
        filteredBattles = filteredBattles.filter(battle => battle.tier.toString() === tier);
    }
    
    // Відображаємо відфільтровані бої
    displayPlayerBattles(filteredBattles);
}

// Отримання мітки типу танка
function getTankTypeLabel(type) {
    switch(type) {
        case 'HT': return 'Важкий танк';
        case 'MT': return 'Середній танк';
        case 'TD': return 'ПТ-САУ';
        case 'LT': return 'Легкий танк';
        case 'SPG': return 'САУ';
        default: return type;
    }
}

// Отримання кольору відсотка перемог
function getWinrateColor(winrate) {
    if (winrate >= 65) return '#9130e0'; // унікум
    if (winrate >= 60) return '#5a01d5'; // супер
    if (winrate >= 56) return '#02c9b3'; // відмінно
    if (winrate >= 53) return '#44cb4c'; // хороший
    if (winrate >= 50) return '#cfcd38'; // середній
    if (winrate >= 47) return '#dd8c39'; // нижче середнього
    return '#e33a36'; // поганий
}

// Відкриття профілю на Tomato.GG
function openTomatoGGProfile() {
    if (!currentPlayer) {
        showMessage('Спочатку знайдіть гравця', 'error');
        return;
    }
    
    const tomatoURL = `https://tomato.gg/stats/${currentPlayer.server}/${encodeURIComponent(currentPlayer.nickname)}-${currentPlayer.id}`;
    window.open(tomatoURL, '_blank');
}

// Відкриття профілю на офіційному сайті WoT
function openWotProfile() {
    if (!currentPlayer) {
        showMessage('Спочатку знайдіть гравця', 'error');
        return;
    }
    
    let wotDomain = 'https://worldoftanks.eu';
    
    switch(currentPlayer.server) {
        case 'NA':
            wotDomain = 'https://worldoftanks.com';
            break;
        case 'ASIA':
            wotDomain = 'https://worldoftanks.asia';
            break;
    }
    
    const wotURL = `${wotDomain}/en/community/accounts/${currentPlayer.id}-${encodeURIComponent(currentPlayer.nickname)}/`;
    window.open(wotURL, '_blank');
}

// Функція для показу повідомлень
function showMessage(message, type) {
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');
    
    // Спочатку ховаємо всі повідомлення
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    
    // Видаляємо клас анімації виходу, якщо він був
    errorEl.classList.remove('slide-out');
    successEl.classList.remove('slide-out');
    
    let alertEl;
    
    if (type === 'error') {
        alertEl = errorEl;
        // Оновлюємо вміст повідомлення з іконкою
        alertEl.innerHTML = `
            <span class="alert-close">&times;</span>
            <div class="alert-icon"><span class="material-icons">error_outline</span></div>
            <div class="alert-message">${message}</div>
        `;
    } else {
        alertEl = successEl;
        // Оновлюємо вміст повідомлення з іконкою
        alertEl.innerHTML = `
            <span class="alert-close">&times;</span>
            <div class="alert-icon"><span class="material-icons">check_circle_outline</span></div>
            <div class="alert-message">${message}</div>
        `;
    }
    
    // Додаємо обробник закриття
    const closeBtn = alertEl.querySelector('.alert-close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            hideMessage(alertEl);
        };
    }
    
    // Показуємо повідомлення
    alertEl.style.display = 'block';
    
    // Автоматично ховаємо повідомлення через 5 секунд
    setTimeout(() => {
        hideMessage(alertEl);
    }, 5000);
}

// Функція для плавного приховування повідомлення
function hideMessage(element) {
    if (element && element.style.display !== 'none') {
        element.classList.add('slide-out');
        
        // Прибираємо елемент після завершення анімації
        setTimeout(() => {
            element.style.display = 'none';
            element.classList.remove('slide-out');
        }, 300); // 300мс - тривалість анімації
    }
}

// Ініціалізація сторінки
document.addEventListener('DOMContentLoaded', initApp);