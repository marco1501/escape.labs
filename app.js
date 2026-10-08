/* ========================================================
   escape.labs ❖ Master Engine (v0.0.3 - Harz Edition Full)
   by forester.labs
   ======================================================== */

/* 🛑 INTELLIGENTE SERVICE-WORKER WEICHE */
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (isLocalhost && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => { for (let r of regs) r.unregister(); });
    caches.keys().then(keys => { for (let k of keys) caches.delete(k); });
} else if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
}

let qrScanner = null;
let leafletMap = null;
let mapMarkers = [];
let userLocationMarker = null;
let gpsWatchId = null;
let compassWatchId = null;
let videoTrack = null;
let wakeLock = null;
let audioCtx = null;
let isMuted = false;

/* ========================================================
   1. UI CONTROLLER (THEMES, VIEWS, MODALS)
   ======================================================== */
const UI = {
    toggle(id) { document.getElementById(id).classList.toggle('active'); },
    
    showView(viewId, pushHistory = true) {
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        const el = document.getElementById(viewId);
        if (el) el.classList.add('active');
        document.getElementById('menu-panel').classList.remove('active');
        window.scrollTo(0, 0);

        const inGameViews = ['view-station', 'view-map', 'view-dossier', 'view-hueter', 'view-admin', 'view-victory', 'view-story'];
        const isGaming = inGameViews.includes(viewId);
        
        document.body.classList.toggle('in-game', isGaming);
        const bNav = document.getElementById('game-bottom-nav');
        if (bNav) bNav.classList.toggle('hidden', !isGaming || viewId === 'view-victory');
        const ftr = document.getElementById('app-footer');
        if (ftr) ftr.classList.toggle('hidden', isGaming || viewId === 'view-dev-studio');

        if (isGaming) this.updateBottomNavState(viewId);
        if (viewId === 'view-map') setTimeout(() => App.initOrUpdateMap(), 150);
        if (viewId === 'view-story') App.renderChronicle();

        if (pushHistory) history.pushState({ view: viewId }, '', '#' + viewId);
    },

    updateBottomNavState(activeViewId) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[data-target="${activeViewId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    },

    applyGameTheme(theme) {
        if (!theme) return;
        const r = document.documentElement;
        if (theme.accent) r.style.setProperty('--accent', theme.accent);
        if (theme.accentGlow) r.style.setProperty('--accent-glow', theme.accentGlow);
        if (theme.bgOuter) r.style.setProperty('--bg-outer', theme.bgOuter);
        if (theme.bgInner) r.style.setProperty('--bg-inner', theme.bgInner);
        if (theme.textColor) r.style.setProperty('--text-color', theme.textColor);
        if (theme.bgImage) {
            document.body.style.backgroundImage = `linear-gradient(rgba(11,16,23,0.88), rgba(11,16,23,0.95)), url('${theme.bgImage}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundAttachment = "fixed";
        }
        if (theme.font) document.body.style.fontFamily = theme.font;

        const metaTheme = document.getElementById('meta-theme-color');
        if (metaTheme && theme.bgInner) metaTheme.setAttribute('content', theme.bgInner);
    },

    resetDefaultTheme() {
        this.initSettings();
        document.body.style.backgroundImage = "none";
        document.body.style.fontFamily = "'All Round Gothic', 'Allround Gothic', 'Comfortaa', 'Poppins', sans-serif";
    },

    resetSettings() {
        localStorage.removeItem('escape_theme');
        localStorage.removeItem('escape_accent');
        localStorage.removeItem('escape_font_size');
        localStorage.removeItem('escape_haptics');

        this.setTheme('dark');
        this.setAccent('#2e7d32');
        const picker = document.getElementById('accentColorPicker');
        if (picker) picker.value = '#2e7d32';
        this.setFontSize(16);
        const range = document.getElementById('fontSizeRange');
        if (range) range.value = 16;
        const hapt = document.getElementById('check-haptics');
        if (hapt) hapt.checked = true;
        this.toggleHaptics(true);
    },

    setTheme(mode) {
        document.body.className = mode + '-mode';
        const dBtn = document.getElementById('theme-btn-dark');
        if (dBtn) dBtn.classList.toggle('active', mode === 'dark');
        const lBtn = document.getElementById('theme-btn-light');
        if (lBtn) lBtn.classList.toggle('active', mode === 'light');
        const metaTheme = document.getElementById('meta-theme-color');
        if (metaTheme) metaTheme.setAttribute('content', mode === 'dark' ? '#0b1017' : '#ffffff');
        localStorage.setItem('escape_theme', mode);
    },

    setAccent(color) {
        document.documentElement.style.setProperty('--accent', color);
        const r = parseInt(color.slice(1, 3), 16) || 46;
        const g = parseInt(color.slice(3, 5), 16) || 125;
        const b = parseInt(color.slice(5, 7), 16) || 50;
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.45)`);
        localStorage.setItem('escape_accent', color);
    },

    setFontSize(px) {
        document.documentElement.style.setProperty('--font-size', px + 'px');
        const lbl = document.getElementById('lbl-font-size');
        if (lbl) lbl.innerText = `Schriftgröße (${px}px)`;
        localStorage.setItem('escape_font_size', px);
    },

    toggleHaptics(enabled) { localStorage.setItem('escape_haptics', enabled ? 'true' : 'false'); },
    
    vibrate(pattern = [60, 50, 60]) {
        if (localStorage.getItem('escape_haptics') === 'false') return;
        if (navigator.vibrate) navigator.vibrate(pattern);
    },

    initSettings() {
        const theme = localStorage.getItem('escape_theme') || 'dark';
        const accent = localStorage.getItem('escape_accent') || '#2e7d32';
        const size = localStorage.getItem('escape_font_size') || '16';
        const haptics = localStorage.getItem('escape_haptics') !== 'false';

        this.setTheme(theme);
        this.setAccent(accent);
        const picker = document.getElementById('accentColorPicker');
        if (picker) picker.value = accent;
        this.setFontSize(size);
        const range = document.getElementById('fontSizeRange');
        if (range) range.value = size;
        const hapt = document.getElementById('check-haptics');
        if (hapt) hapt.checked = haptics;
    },

    /* MODAL-HANDLING */
    openGuide() { document.getElementById('modal-guide')?.classList.add('active'); },
    closeGuide() { document.getElementById('modal-guide')?.classList.remove('active'); },
    openAbout() { document.getElementById('modal-about')?.classList.add('active'); },
    closeAbout() { document.getElementById('modal-about')?.classList.remove('active'); },

    openWalkthrough() {
        const box = document.getElementById('walkthrough-solution-box');
        const btn = document.getElementById('btn-reveal-solution');
        const advBtn = document.getElementById('btn-advance-solution');
        if (box) box.classList.add('hidden');
        if (advBtn) advBtn.classList.add('hidden');
        if (btn) btn.classList.remove('hidden');
        document.getElementById('modal-walkthrough')?.classList.add('active');
    },
    closeWalkthrough() { document.getElementById('modal-walkthrough')?.classList.remove('active'); },

    openCastModal() {
        const g = App.getCurrentGameContext();
        const list = document.getElementById('cast-cards-list');
        if (!list) return;
        list.innerHTML = "";

        if (!g || !g.cast || g.cast.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">Keine Rollenprofile hinterlegt.</div>`;
        } else {
            g.cast.forEach(c => {
                const card = document.createElement('div');
                card.style = "background:rgba(128,128,128,0.06); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:10px;";
                card.innerHTML = `
                    <div style="display:flex; gap:12px; align-items:center;">
                        ${c.avatar ? `<img src="${c.avatar}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">` : ''}
                        <div>
                            <strong style="font-size:1rem; color:var(--accent);">${c.name}</strong><br>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${c.role || ''}</span>
                        </div>
                    </div>
                    <p style="font-size:0.85rem; margin:8px 0; line-height:1.5;">${c.bio || ''}</p>
                    ${c.dresscode ? `<div style="font-size:0.78rem; background:rgba(0,0,0,0.3); padding:8px; border-radius:8px;">🎭 <strong>Verkleidung/Requisiten:</strong> ${c.dresscode}</div>` : ''}
                `;
                list.appendChild(card);
            });
        }
        document.getElementById('modal-cast')?.classList.add('active');
    },
    closeCastModal() { document.getElementById('modal-cast')?.classList.remove('active'); },

    openToolbox() {
        document.getElementById('modal-toolbox')?.classList.add('active');
        document.getElementById('toolbox-active-view')?.classList.add('hidden');
    },

    closeToolbox() {
        if (qrScanner) { 
            try { qrScanner.stop().then(() => qrScanner.clear()); } catch(e){} 
            qrScanner = null; 
        }
        if (compassWatchId) {
            window.removeEventListener('deviceorientationabsolute', compassWatchId, true);
            window.removeEventListener('deviceorientation', compassWatchId, true);
            compassWatchId = null;
        }
        document.getElementById('modal-toolbox')?.classList.remove('active');
    },

    openToolView(tool) {
        const v = document.getElementById('toolbox-active-view');
        if (!v) return;
        v.classList.remove('hidden');

        if (tool === 'scanner') {
            v.innerHTML = `
                <div id="qr-reader" style="width:100%; border-radius:12px; overflow:hidden;"></div>
                <p style="font-size:0.75rem; color:var(--text-muted); text-align:center; margin-top:8px;">Kamera auf QR-Code halten.</p>
            `;
            try {
                qrScanner = new Html5Qrcode("qr-reader");
                qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (txt) => {
                    UI.closeToolbox();
                    App.handleScannedCode(txt);
                }, ()=>{}).catch(()=>alert("Kamera nicht verfügbar."));
            } catch(e){}
        } else if (tool === 'notes') {
            v.innerHTML = `
                <textarea id="notes-text" class="clean-input" placeholder="Rätsel-Notizen..." style="height:180px; resize:none; font-family:inherit;" autocomplete="off" autocorrect="off" spellcheck="false" oninput="App.saveNotes(this.value)">${localStorage.getItem('escape_notes_text')||''}</textarea>
            `;
        } else if (tool === 'sketch') {
            v.innerHTML = `
                <canvas id="sketch-canvas" width="380" height="220" style="border:1px solid var(--border); border-radius:12px; background:#000; width:100%; touch-action:none; margin-top:6px;"></canvas>
                <button onclick="App.clearCanvas()" class="btn-sub" style="font-size:0.75rem; padding:8px; margin-top:6px;">Skizze löschen</button>
            `;
            setTimeout(() => App.initCanvas(), 50);
        } else if (tool === 'compass') {
            v.innerHTML = `
                <div style="text-align:center; padding:14px 0;">
                    <div id="compass-deg" style="font-size:2.5rem; font-weight:700; color:var(--accent); font-family:monospace;">--°</div>
                    <div id="compass-dir" style="font-size:0.9rem; color:var(--text-muted); font-weight:600; margin-top:4px;">Peilung wird ermittelt...</div>
                    <button id="btn-compass-perm" onclick="App.requestCompassPermission()" class="btn-sub" style="margin-top:12px; display:none;">Kompass-Zugriff erlauben</button>
                </div>
            `;
            App.startCompass();
        }
    },

    openRoleProfile() {
        const g = App.getActiveGame();
        if (!g || !App.activeRole) return;
        const container = document.getElementById('role-profile-content');
        if (!container) return;

        let avatar = "";
        let bio = "";
        let dresscode = "";
        if (g.cast && Array.isArray(g.cast)) {
            const match = g.cast.find(c => (c.id === App.activeRole.id) || (c.name && c.name.toLowerCase() === App.activeRole.name.toLowerCase()));
            if (match) {
                avatar = match.avatar || "";
                bio = match.bio || "";
                dresscode = match.dresscode || "";
            }
        }

        container.innerHTML = `
            <div style="background:rgba(128,128,128,0.06); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px; text-align:center;">
                ${avatar ? `<img src="${avatar}" style="width:75px; height:75px; border-radius:50%; object-fit:cover; border:2px solid var(--accent); margin-bottom:8px;">` : `
                <div style="width:60px; height:60px; border-radius:50%; background:rgba(46,125,50,0.15); color:var(--accent); display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
                    <span class="material-symbols-rounded" style="font-size:32px;">person</span>
                </div>`}
                <h3 style="font-size:1.15rem; color:var(--accent); margin-bottom:2px;">${App.activeRole.name}</h3>
                <span class="badge" style="margin-bottom:0;">Rolle: ${App.activeRole.roleTitle || App.activeRole.name}</span>
            </div>
            <div style="background:rgba(128,128,128,0.04); border-left:3px solid var(--accent); padding:12px; border-radius:8px; margin-bottom:10px; font-size:0.85rem; line-height:1.5;">
                <strong style="color:#fff;">Deine Spezial-Aufgabe:</strong><br>
                ${App.activeRole.note || 'Arbeite mit deinem Team zusammen, teile deine Hinweise und höre den anderen Rollen gut zu.'}
            </div>
            ${bio ? `<p style="font-size:0.82rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">${bio}</p>` : ''}
            ${dresscode ? `<div style="font-size:0.78rem; background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:8px; color:var(--text-color);">🎭 <strong>Empfohlene Requisite:</strong> ${dresscode}</div>` : ''}
        `;
        document.getElementById('modal-role')?.classList.add('active');
    },

    closeRoleModal() { document.getElementById('modal-role')?.classList.remove('active'); }
};

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) UI.showView(e.state.view, false);
    else App.showHome(false);
});

/* ========================================================
   2. APP & GAME ENGINE LOGIK
   ======================================================== */
const App = {
    library: {},      
    catalog: [],      
    previewGameId: null,
    activeGameId: null,
    activeRole: null,
    gameProgress: {},
    failedAttempts: 0,
    sandboxGame: null,
    timerInterval: null,
    timerSeconds: 0,
    timerRunning: false,
    currentCryptex: [0, 0, 0, 0],
    incomingCallData: null,

    init() {
        UI.initSettings();

        const storedLib = localStorage.getItem('escapelabs_library');
        if (storedLib) {
            try { this.library = JSON.parse(storedLib); } catch(e){}
        }

        const savedProg = localStorage.getItem('escape_progress');
        if (savedProg) {
            try { this.gameProgress = JSON.parse(savedProg); } catch(e){}
        }

        this.fetchOnlineCatalog();

        const urlParams = new URLSearchParams(window.location.search);
        const playParam = urlParams.get('play');
        if (playParam) {
            this.loadAndLaunchDirectGame(playParam);
        } else {
            this.showHome(false);
        }

        setTimeout(() => this.dismissSplash(), 1800);
        this.renderHomeGames();
        history.replaceState({ view: 'view-home' }, '', '#view-home');
    },

    dismissSplash() {
        const splash = document.getElementById('splash-screen');
        if (splash && !splash.classList.contains('fade-out')) splash.classList.add('fade-out');
    },

    saveLibrary() { localStorage.setItem('escapelabs_library', JSON.stringify(this.library)); },
    saveProgress() { 
        if (this.activeGameId && this.gameProgress[this.activeGameId]) {
            this.gameProgress[this.activeGameId].timerSeconds = this.timerSeconds;
        }
        localStorage.setItem('escape_progress', JSON.stringify(this.gameProgress)); 
    },

    switchHubTab(tab) {
        const btnLocal = document.getElementById('tab-btn-local');
        const btnStore = document.getElementById('tab-btn-store');
        const viewLocal = document.getElementById('hub-view-local');
        const viewStore = document.getElementById('hub-view-store');

        if (tab === 'local') {
            btnLocal?.classList.add('active'); btnStore?.classList.remove('active');
            viewLocal?.classList.remove('hidden'); viewStore?.classList.add('hidden');
            this.renderHomeGames();
        } else {
            btnStore?.classList.add('active'); btnLocal?.classList.remove('active');
            viewStore?.classList.remove('hidden'); viewLocal?.classList.add('hidden');
            this.renderStore();
        }
    },

    fetchOnlineCatalog() {
        fetch('./games/catalog.json')
            .then(res => res.json())
            .then(data => { this.catalog = data; this.renderStore(); })
            .catch(() => { this.catalog = []; });
    },

    renderStore() {
        const container = document.getElementById('store-container');
        if (!container) return;
        container.innerHTML = "";

        if (!this.catalog || this.catalog.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">Aktuell sind keine Spiele im Online-Store verfügbar.</div>`;
            return;
        }

        this.catalog.forEach(item => {
            const isInstalled = !!this.library[item.id];
            const card = document.createElement('div');
            card.className = "game-thumb-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="badge">${item.region || 'Online-Szenario'}</span>
                    <span style="font-size:0.75rem; color:${isInstalled ? '#22c55e' : 'var(--text-muted)'}; font-weight:700;">
                        ${isInstalled ? 'INSTALLIERT' : 'VERFÜGBAR'}
                    </span>
                </div>
                <h2 style="font-size:1.15rem; margin-top:2px;">${item.title}</h2>
                <p style="font-size:0.85rem; color:var(--text-muted);">${item.subtitle || ''}</p>
                ${item.previewImage ? `<img class="preview-image" src="${item.previewImage}" alt="${item.title}">` : ''}
                <p style="font-size:0.82rem; margin-top:6px; line-height:1.5;">${item.description || ''}</p>
                <button onclick="App.installFromStore('${item.id}', '${item.file}')" class="${isInstalled ? 'btn-sub' : 'btn-main'}" style="margin-top:10px; padding:10px; font-size:0.85rem;">
                    <span class="material-symbols-rounded">${isInstalled ? 'check_circle' : 'download'}</span>
                    ${isInstalled ? 'Erneut herunterladen' : 'In App laden'}
                </button>
            `;
            container.appendChild(card);
        });
    },

    installFromStore(gameId, filePath) {
        fetch(filePath)
            .then(res => {
                if (!res.ok) throw new Error("Datei nicht gefunden.");
                return res.json();
            })
            .then(gameData => {
                this.library[gameData.id] = gameData;
                this.saveLibrary();
                alert(`'${gameData.title}' wurde erfolgreich heruntergeladen!`);
                this.switchHubTab('local');
                this.showHome();
            })
            .catch(err => alert("Fehler beim Herunterladen: " + err.message));
    },

    loadAndLaunchDirectGame(gameId) {
        if (this.library[gameId]) {
            this.openGameMenu(gameId);
            return;
        }
        fetch(`./games/${gameId}.json`)
            .then(res => res.json())
            .then(gameData => {
                this.library[gameData.id] = gameData;
                this.saveLibrary();
                this.openGameMenu(gameData.id);
            })
            .catch(() => this.showHome(false));
    },

    shareCurrentGame() {
        const shareUrl = window.location.origin + window.location.pathname + '?play=' + this.previewGameId;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("📋 Start-Link kopiert! Sende diesen Link deinen Mitspielern:\n\n" + shareUrl);
        }).catch(() => {
            prompt("Link kopieren:", shareUrl);
        });
    },

    deleteCurrentGame() {
        if (!this.previewGameId) return;
        const g = this.library[this.previewGameId];
        if (confirm(`Möchtest du '${g.title}' wirklich aus deiner Bibliothek löschen?`)) {
            delete this.library[this.previewGameId];
            delete this.gameProgress[this.previewGameId];
            this.saveLibrary();
            this.saveProgress();
            this.renderHomeGames();
            this.showHome();
        }
    },

    showHome(pushHistory = true) {
        UI.resetDefaultTheme();
        this.renderHomeGames();
        UI.showView('view-home', pushHistory);
    },

    renderHomeGames() {
        const container = document.getElementById('games-container');
        if (!container) return;
        container.innerHTML = "";
        const keys = Object.keys(this.library);

        if (keys.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">Kein Spiel installiert. Lade dein Spiel über den Online-Store oder Dev-Modus!</div>`;
            return;
        }

        keys.forEach(k => {
            const g = this.library[k];
            const prog = this.gameProgress[g.id] || { stage: 'stations', station: 1, unlocked: [], completed: false };
            const isCompleted = prog.completed === true;

            const card = document.createElement('div');
            card.className = "game-thumb-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="badge">${g.region || 'Szenario'}</span>
                    ${isCompleted ? '<span class="badge" style="color:#f59e0b; border-color:#f59e0b;">🏆 GESCHAFFT</span>' : ''}
                </div>
                <h2 style="font-size:1.15rem; margin-top:2px;">${g.title}</h2>
                <p style="font-size:0.85rem; color:var(--text-muted);">${g.subtitle || ''}</p>
                ${g.previewImage ? `<img class="preview-image" style="height:140px;" src="${g.previewImage}" alt="${g.title}">` : ''}
            `;
            card.onclick = () => this.openGameMenu(g.id);
            container.appendChild(card);
        });
    },

    openGameMenu(gameId) {
        this.previewGameId = gameId;
        const g = this.getCurrentGameContext();
        if (!g) return;

        if (g.theme) UI.applyGameTheme(g.theme);

        document.getElementById('gm-title').innerText = g.title;
        document.getElementById('gm-sub').innerText = g.subtitle || '';
        document.getElementById('gm-desc').innerText = g.description || '';
        document.getElementById('gm-region').innerText = g.region || 'Unbekannt';
        document.getElementById('gm-time').innerText = g.timeEst || 'ca. 1–2 Std.';

        const img = document.getElementById('gm-img');
        if (g.previewImage) {
            img.src = g.previewImage;
            img.classList.remove('hidden');
        } else {
            img?.classList.add('hidden');
        }

        UI.showView('view-game-menu');
    },

    startFreshGame() {
        this.timerSeconds = 0;
        this.gameProgress[this.previewGameId] = { 
            stage: 'prologue',
            prologueIdx: 0,
            station: 1, 
            routeSolved: {},
            unlocked: [], 
            hint: null, 
            penalties: 0, 
            geofencesTriggered: [], 
            timerSeconds: 0, 
            revealedHints: {} 
        };
        this.saveProgress();
        this.openLogin(true);
    },

    getCurrentGameContext() {
        return (this.sandboxGame && this.sandboxGame.id === this.previewGameId) ? this.sandboxGame : this.library[this.previewGameId];
    },

    /* 🪪 MODULARE AUTHENTIFIZIERUNG */
    openLogin(freshStart = false) {
        const g = this.getCurrentGameContext();
        if (!g) return;

        document.getElementById('login-game-title').innerText = g.title;
        const container = document.getElementById('auth-dynamic-container');
        const help = document.getElementById('login-pin-help');
        const promptText = document.getElementById('login-prompt-text');
        container.innerHTML = "";
        help.innerHTML = "";

        const authType = g.authType || "pin";

        if (authType === "select") {
            promptText.innerText = "Wähle deine Rolle für das Spiel:";

            if (g.cast && Array.isArray(g.cast)) {
                g.cast.forEach(c => {
                    const b = document.createElement('div');
                    b.className = "game-thumb-card";
                    b.style = "cursor:pointer; margin-bottom:12px; padding:12px; border:1px solid var(--border);";
                    b.innerHTML = `
                        <div style="display:flex; gap:12px; align-items:center;">
                            <img src="${c.avatar}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">
                            <div>
                                <strong style="color:var(--accent); font-size:1rem;">${c.name}</strong><br>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${c.role}</span>
                            </div>
                        </div>
                        <p style="font-size:0.8rem; margin-top:8px; line-height:1.4;">${c.bio || ''}</p>
                    `;
                    b.onclick = () => this.executeLogin({ id: c.id, type: c.id === 'player' ? 'player' : 'guardian', name: c.name, roleTitle: c.role });
                    container.appendChild(b);
                });
            }

            const adm = document.createElement('button');
            adm.className = "btn-sub";
            adm.style = "margin-top:10px;";
            adm.innerHTML = `<span class="material-symbols-rounded">tune</span> ${g.roles?.admin?.name || 'Spielleitung (Admin)'}`;
            adm.onclick = () => {
                const p = prompt("Admin-Code eingeben:");
                if (String(p).trim() === String(g.roles?.admin?.pin || '1964').trim()) {
                    this.executeLogin({ id: 'admin', type: 'admin', name: g.roles?.admin?.name || 'Admin' });
                } else alert("Falscher Admin-Code!");
            };
            container.appendChild(adm);

        } else if (authType === "password") {
            promptText.innerText = "Gib das geheime Losungswort ein:";
            container.innerHTML = `
                <input type="text" id="input-auth-field" class="clean-input" placeholder="Losungswort..." style="text-align:center;" autocomplete="off">
                <button onclick="App.submitLoginText()" class="btn-main"><span class="material-symbols-rounded">key</span> Bestätigen</button>
            `;
        } else {
            promptText.innerText = "Gib deinen Rollen-Code ein:";
            container.innerHTML = `
               <input type="text" id="input-auth-field" class="clean-input" placeholder="••••" inputmode="numeric" style="text-align:center; font-size:1.4rem; letter-spacing:4px;" autocomplete="off">
                <button onclick="App.submitLoginPin()" class="btn-main"><span class="material-symbols-rounded">lock_open</span> Einloggen</button>
            `;

            const r = g.roles;
            let hHtml = `<strong>Rollen-PINs:</strong><br>• ${r.player.name}: <strong>${r.player.pin}</strong><br>`;
            if (r.guardians) r.guardians.forEach(gh => hHtml += `• ${gh.name}: <strong>${gh.pin}</strong><br>`);
            hHtml += `• ${r.admin.name}: <strong>${r.admin.pin}</strong>`;
            help.innerHTML = hHtml;
        }

        UI.showView('view-login');
    },

    submitLoginPin() {
        const val = document.getElementById('input-auth-field').value.replace(/\D/g, '');
        const g = this.getCurrentGameContext();
        const r = g.roles;

        if (val === String(r.player.pin).replace(/\D/g, '')) {
            this.executeLogin({ id: 'player', type: 'player', name: r.player.name });
        } else if (val === String(r.admin.pin).replace(/\D/g, '')) {
            this.executeLogin({ id: 'admin', type: 'admin', name: r.admin.name });
        } else if (r.guardians) {
            const found = r.guardians.find(x => String(x.pin).replace(/\D/g, '') === val);
            if (found) this.executeLogin({ id: found.id || 'guardian', type: 'guardian', name: found.name, note: found.note });
            else document.getElementById('login-feedback').innerText = "Falscher PIN!";
        } else {
            document.getElementById('login-feedback').innerText = "Falscher PIN!";
        }
    },

    submitLoginText() {
        const val = document.getElementById('input-auth-field').value.trim().toUpperCase();
        const g = this.getCurrentGameContext();
        const r = g.roles;

        if (val === String(r.player.pin).trim().toUpperCase()) {
            this.executeLogin({ id: 'player', type: 'player', name: r.player.name });
        } else if (val === String(r.admin.pin).trim().toUpperCase()) {
            this.executeLogin({ id: 'admin', type: 'admin', name: r.admin.name });
        } else {
            document.getElementById('login-feedback').innerText = "Ungültiges Losungswort!";
        }
    },

    executeLogin(roleObj) {
        this.activeGameId = this.previewGameId;
        this.activeRole = roleObj;
        this.failedAttempts = 0;

        if (!this.gameProgress[this.activeGameId]) {
            this.gameProgress[this.activeGameId] = { 
                stage: 'prologue',
                prologueIdx: 0,
                station: 1, 
                routeSolved: {},
                unlocked: [], 
                hint: null, 
                penalties: 0, 
                geofencesTriggered: [], 
                timerSeconds: 0, 
                revealedHints: {} 
            };
            this.saveProgress();
        }

        const prog = this.gameProgress[this.activeGameId];
        this.timerSeconds = prog.timerSeconds || 0;
        this.updateTimerDisplay();

        const g = this.getCurrentGameContext();
        this.buildDynamicBottomNav(g);
        this.startTimer();
        this.requestWakeLock();
        this.startGpsTracking();
        this.updateMenu();
        this.renderStation();
        this.renderDossier();
        this.renderLiveHint();

        if (roleObj.type === 'admin') UI.showView('view-admin');
        else UI.showView('view-station');
    },

    buildDynamicBottomNav(game) {
        const nav = document.getElementById('game-bottom-nav');
        if (!nav) return;
        nav.innerHTML = "";

        const tabs = (game.navigation && Array.isArray(game.navigation)) ? game.navigation : [
            { id: 'view-station', label: 'Station', icon: 'explore' },
            { id: 'view-map', label: 'Karte', icon: 'map' },
            { id: 'view-dossier', label: 'Akte', icon: 'folder_open' },
            { id: 'view-story', label: 'Chronik', icon: 'menu_book' }
        ];

        tabs.forEach(t => {
            const btn = document.createElement('button');
            btn.className = "nav-btn";
            btn.setAttribute('data-target', t.id);
            btn.innerHTML = `<span class="material-symbols-rounded">${t.icon || 'star'}</span><span>${t.label}</span>`;
            btn.onclick = () => UI.showView(t.id);
            nav.appendChild(btn);
        });

        if (this.activeRole && (this.activeRole.type === 'guardian' || this.activeRole.type === 'admin')) {
            const hBtn = document.createElement('button');
            hBtn.className = "nav-btn";
            hBtn.setAttribute('data-target', 'view-hueter');
            hBtn.innerHTML = `<span class="material-symbols-rounded">shield</span><span>Hüter</span>`;
            hBtn.onclick = () => UI.showView('view-hueter');
            nav.appendChild(hBtn);
        }

        if (this.activeRole && this.activeRole.type === 'admin') {
            const aBtn = document.createElement('button');
            aBtn.className = "nav-btn";
            aBtn.setAttribute('data-target', 'view-admin');
            aBtn.innerHTML = `<span class="material-symbols-rounded">tune</span><span>Admin</span>`;
            aBtn.onclick = () => UI.showView('view-admin');
            nav.appendChild(aBtn);
        }
    },

    /* ========================================================
       3. STATIONEN, PROLOG & RÄTSEL-ENGINE (2-STUFIG + AUDIO)
       ======================================================== */
    renderStation() {
        const g = this.getActiveGame();
        if (!g) return;
        const prog = this.gameProgress[this.activeGameId];

        // 🟢 FALL 1: PROLOG-PHASE
        if (g.prologue && prog.stage === 'prologue') {
            const pQuestions = g.prologue.questions || [];
            const idx = prog.prologueIdx || 0;

            if (idx >= pQuestions.length) {
                prog.stage = 'stations';
                prog.station = 1;
                this.saveProgress();
                this.renderStation();
                return;
            }

            const pItem = pQuestions[idx];
            document.getElementById('st-badge').innerText = `PROLOG (${idx + 1}/${pQuestions.length})`;
            document.getElementById('st-location').innerText = "Vorbereitung zu Hause";
            document.getElementById('st-title').innerText = pItem.title;
            document.getElementById('st-story').innerText = idx === 0 && g.prologue.intro ? g.prologue.intro.text : pItem.storyUnlocked;

            const mediaBox = document.getElementById('st-media-box');
            mediaBox.innerHTML = "";

            if (idx === 0 && g.prologue.intro) {
                this.playNarrative(g.prologue.intro.audio, g.prologue.intro.ttsText);
            }

            document.getElementById('st-question').innerText = pItem.riddle.question;
            this.renderRiddleInput(pItem.riddle);
            this.renderAdminDebugBar(pItem.riddle, true);
            return;
        }

        // 🟢 FALL 2: REGULÄRE HARZ-STATIONEN
        const st = g.stations.find(s => s.id === prog.station);
        if (!st) {
            this.showVictoryScreen();
            return;
        }

        document.getElementById('st-badge').innerText = st.roman || `Station ${st.id}`;
        document.getElementById('st-location').innerText = st.targetLocation || st.location || "";
        document.getElementById('st-title').innerText = st.title;

        const mediaBox = document.getElementById('st-media-box');
        mediaBox.innerHTML = "";
        if (st.image) mediaBox.innerHTML = `<img class="preview-image" src="${st.image}" alt="${st.title}">`;
        if (st.audio) mediaBox.innerHTML += `<audio controls src="${st.audio}" style="width:100%; margin-top:8px; height:36px;"></audio>`;
        if (st.video) mediaBox.innerHTML += `<video controls src="${st.video}" style="width:100%; border-radius:12px; margin-top:8px;"></video>`;

        this.playNarrative(st.audio, st.ttsText);

        const isRouteDone = prog.routeSolved && prog.routeSolved[st.id];
        const isArrived = prog.geofencesTriggered && prog.geofencesTriggered.includes(st.id);

        // STUFE 1: WEGWEISER-RÄTSEL ("Wo geht es hin?")
        if (st.routeRiddle && !isRouteDone) {
            document.getElementById('st-story').innerHTML = `
                <div style="background:rgba(46,125,50,0.15); border-left:3px solid var(--accent); padding:10px; border-radius:6px; margin-bottom:12px;">
                    🧭 <strong>Etappe 1: Wegweiser entschlüsseln</strong><br>Findet heraus, an welchen realen Ort im Harz die nächste Fährte führt!
                </div>
            `;
            document.getElementById('st-question').innerText = st.routeRiddle.question;
            this.renderRiddleInput(st.routeRiddle);
            this.renderAdminDebugBar(st.routeRiddle, false);
            return;
        }

        // STUFE 2: ANKUNFTSSPERRE
        if (!isArrived && st.unlock) {
            document.getElementById('st-story').innerHTML = `
                <div style="text-align:center; padding:24px 12px; background:rgba(0,0,0,0.3); border-radius:14px; border:1px dashed var(--accent);">
                    <span class="material-symbols-rounded" style="font-size:48px; color:var(--accent);">location_on</span>
                    <h3 style="margin:8px 0; color:#fff;">Zielort: ${st.targetLocation}</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5;">
                        Die Station öffnet sich automatisch, sobald ihr euch dem Zielort nähert (Geofence aktiv).
                    </p>
                    <button onclick="UI.openToolView('scanner')" class="btn-sub" style="margin-top:12px;">
                        <span class="material-symbols-rounded">qr_code_scanner</span> Vor-Ort-QR scannen
                    </button>
                </div>
            `;
            document.getElementById('st-question').innerText = "";
            document.getElementById('quiz-inputs').innerHTML = "";
            this.renderAdminDebugBar({ answer: "Standort-Bypass" }, false, true);
            return;
        }

        // STUFE 3: VOR-ORT-HAUPTRÄTSEL
        document.getElementById('st-story').innerText = st.story;

        const roleKey = this.activeRole?.id || 'player';
        const roleData = st.roleContent ? st.roleContent[roleKey] : null;

        const roleBox = document.getElementById('hueter-note-text');
        if (roleBox) {
            if (roleData) {
                roleBox.innerHTML = `<strong>${roleData.title}</strong><br>${roleData.instruction}`;
            } else {
                roleBox.innerText = st.guardianNote || "Keine spezielle Anweisung.";
            }
        }

        const activeRiddle = st.siteRiddle || st.riddle;
        document.getElementById('st-question').innerText = activeRiddle.question;

        if (!roleData || roleData.showInput !== false || this.activeRole?.type === 'admin') {
            this.renderRiddleInput(activeRiddle);
        } else {
            document.getElementById('quiz-inputs').innerHTML = `
                <div style="text-align:center; padding:14px; background:rgba(128,128,128,0.06); border-radius:10px; font-size:0.85rem; color:var(--text-muted);">
                    🔒 Die Eingabe erfolgt auf dem Bildschirm der <strong>Suchenden</strong>. Teile ihr deine Erkenntnisse mit!
                </div>
            `;
        }

        document.getElementById('game-feedback').innerText = "";
        this.renderAdminDebugBar(activeRiddle, false);

        const hints = this.getStationHints(st);
        const progHints = (prog.revealedHints && prog.revealedHints[st.id]) || 0;
        if (progHints > 0 && hints.length > 0) {
            this.updateAutoHintUI(st);
        } else {
            document.getElementById('auto-hint-box')?.classList.add('hidden');
            document.getElementById('auto-hint-text')?.classList.add('hidden');
        }

        if (st.triggerCall) {
            setTimeout(() => {
                this.triggerSimulatedCall(st.triggerCall.caller || 'Zentrale', st.triggerCall.message);
            }, 1200);
        }
    },

    renderRiddleInput(riddle) {
        const wrap = document.getElementById('quiz-inputs');
        wrap.innerHTML = "";
        const rType = riddle.type || "text";

        // 1. Cryptex / Lock-Wheels
        if (rType === "lock-wheels") {
            const rawAns = String(riddle.answer || "0000").replace(/\D/g, '');
            const wheelCount = Math.max(1, Math.min(8, rawAns.length || 4));
            if (!this.currentCryptex || this.currentCryptex.length !== wheelCount) {
                this.currentCryptex = Array(wheelCount).fill(0);
            }
            wrap.innerHTML = `
                <div class="cryptex-container" style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin:16px 0;">
                    ${this.currentCryptex.map((val, i) => `
                        <div class="cryptex-dial">
                            <button onclick="App.turnWheel(${i}, 1)" class="icon-btn" style="padding:2px;"><span class="material-symbols-rounded">arrow_drop_up</span></button>
                            <div class="cryptex-val" id="wheel-${i}">${val}</div>
                            <button onclick="App.turnWheel(${i}, -1)" class="icon-btn" style="padding:2px;"><span class="material-symbols-rounded">arrow_drop_down</span></button>
                        </div>
                    `).join('')}
                </div>
                <button onclick="App.checkCryptexAnswer()" class="btn-main"><span class="material-symbols-rounded">lock_open</span> Schloss öffnen (${wheelCount}-stellig)</button>
            `;
        }
        // 2. Timeline / Order
        else if (rType === "order" && riddle.items) {
            wrap.innerHTML = `
                <div id="order-list-box">
                    ${riddle.items.map((it, idx) => `
                        <div class="sort-item" data-idx="${idx}">
                            <span>${it}</span>
                            <div>
                                <button onclick="App.moveOrderItem(${idx}, -1)" class="icon-btn" style="padding:2px;"><span class="material-symbols-rounded">arrow_upward</span></button>
                                <button onclick="App.moveOrderItem(${idx}, 1)" class="icon-btn" style="padding:2px;"><span class="material-symbols-rounded">arrow_downward</span></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="App.checkOrderAnswer()" class="btn-main" style="margin-top:10px;">Reihenfolge prüfen</button>
            `;
        }
        // 3. Choice
        else if (rType === "choice" && riddle.options) {
            riddle.options.forEach(opt => {
                const b = document.createElement('button');
                b.className = "btn-sub";
                b.innerText = opt;
                b.onclick = () => this.checkAnswer(opt);
                wrap.appendChild(b);
            });
        }
        // 4. Text
        else {
            wrap.innerHTML = `
                <input type="text" id="user-answer-inp" class="clean-input" placeholder="Lösungswort oder Code..." autocomplete="off">
                <button onclick="App.checkAnswer(document.getElementById('user-answer-inp').value)" class="btn-main">Bestätigen</button>
            `;
        }
    },

    /* 🛠️ ADMIN-TESTSPIEL-MODUS (GOD MODE) */
    renderAdminDebugBar(riddle, isPrologue = false, isArrivalLock = false) {
        if (!this.activeRole || this.activeRole.type !== 'admin') return;
        const wrap = document.getElementById('quiz-inputs');
        const debugBox = document.createElement('div');
        debugBox.style = "background:rgba(239,68,68,0.12); border:1px solid #ef4444; border-radius:10px; padding:10px; margin-top:14px; font-size:0.8rem;";

        if (isArrivalLock) {
            debugBox.innerHTML = `
                <strong style="color:#ef4444;">🛠️ Admin-Simulator:</strong><br>
                <button onclick="App.simulateGeofenceArrival()" class="btn-sub" style="margin-top:6px; font-size:0.75rem; border-color:#ef4444; color:#ef4444;">
                    📍 Ankunft vor Ort simulieren (Geofence Bypass)
                </button>
            `;
        } else {
            debugBox.innerHTML = `
                <strong style="color:#ef4444;">🛠️ Admin God-Mode:</strong> Lösung: <strong style="color:#fff;">${riddle.answer}</strong><br>
                <button onclick="App.checkAnswer('${riddle.answer}')" class="btn-sub" style="margin-top:6px; font-size:0.75rem; border-color:#ef4444; color:#ef4444;">
                    ⚡ 1-Klick-Lösung einsetzen
                </button>
            `;
        }
        wrap.appendChild(debugBox);
    },

    simulateGeofenceArrival() {
        const prog = this.gameProgress[this.activeGameId];
        if (!prog.geofencesTriggered) prog.geofencesTriggered = [];
        if (!prog.geofencesTriggered.includes(prog.station)) {
            prog.geofencesTriggered.push(prog.station);
            this.saveProgress();
            alert("📍 Simulator: Ankunft am Zielort erfolgreich simuliert!");
            this.renderStation();
        }
    },

    playNarrative(audioUrl, ttsText) {
        if (isMuted) return;
        if (audioUrl) {
            const a = new Audio(audioUrl);
            a.play().catch(()=>{});
        } else if (ttsText && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(ttsText);
            u.lang = 'de-DE';
            u.rate = 0.88;
            u.pitch = 0.9;
            window.speechSynthesis.speak(u);
        }
    },

    turnWheel(dialIdx, dir) {
        if (!this.currentCryptex || dialIdx < 0 || dialIdx >= this.currentCryptex.length) return;
        this.currentCryptex[dialIdx] = (this.currentCryptex[dialIdx] + dir + 10) % 10;
        const wheelEl = document.getElementById(`wheel-${dialIdx}`);
        if (wheelEl) wheelEl.innerText = this.currentCryptex[dialIdx];
        UI.vibrate(30);
    },
    checkCryptexAnswer() {
        this.checkAnswer(this.currentCryptex.join(''));
    },

    moveOrderItem(idx, dir) {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g.stations.find(s => s.id === prog.station);
        const riddle = st.siteRiddle || st.riddle;
        const targetIdx = idx + dir;

        if (targetIdx >= 0 && targetIdx < riddle.items.length) {
            const temp = riddle.items[idx];
            riddle.items[idx] = riddle.items[targetIdx];
            riddle.items[targetIdx] = temp;
            this.renderStation();
        }
    },
    checkOrderAnswer() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g.stations.find(s => s.id === prog.station);
        const riddle = st.siteRiddle || st.riddle;
        this.checkAnswer(riddle.items.join(';'));
    },

    getActiveGame() {
        return (this.sandboxGame && this.sandboxGame.id === this.activeGameId) ? this.sandboxGame : this.library[this.activeGameId];
    },

    normalizeAnswer(str) {
        if (!str) return "";
        let s = String(str).trim().toLowerCase();
        s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        s = s.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()?"'„“]/g, " ");
        s = s.replace(/\s+/g, ' ').trim();
        const articles = ['der ', 'die ', 'das ', 'ein ', 'eine ', 'einen ', 'einem ', 'einer '];
        for (const art of articles) {
            if (s.startsWith(art)) { s = s.slice(art.length).trim(); break; }
        }
        return s;
    },

    checkAnswer(val) {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const fb = document.getElementById('game-feedback');

        // PROLOG PRÜFEN
        if (prog.stage === 'prologue') {
            const pItem = g.prologue.questions[prog.prologueIdx];
            const cleanUser = String(val||"").trim().toUpperCase();
            const cleanCorr = String(pItem.riddle.answer).trim().toUpperCase();

            if (cleanUser === cleanCorr || (pItem.riddle.acceptedAnswers && pItem.riddle.acceptedAnswers.map(x=>String(x).toUpperCase()).includes(cleanUser))) {
                this.playAudioTone('success');
                prog.prologueIdx = (prog.prologueIdx || 0) + 1;
                this.saveProgress();
                fb.innerText = "Prolog-Siegel gebrochen!";
                setTimeout(() => this.renderStation(), 600);
            } else {
                this.playAudioTone('error');
                fb.innerText = "Nicht ganz richtig.";
            }
            return;
        }

        // REGULÄRE STATION PRÜFEN
        const st = g.stations.find(s => s.id === prog.station);
        const isRouteDone = prog.routeSolved && prog.routeSolved[st.id];
        const riddle = (!isRouteDone && st.routeRiddle) ? st.routeRiddle : (st.siteRiddle || st.riddle);

        const cleanUser = String(val || "").trim().toUpperCase();
        const cleanCorrect = String(riddle.answer || "").trim().toUpperCase();
        const normUser = this.normalizeAnswer(val);
        const normCorrect = this.normalizeAnswer(riddle.answer);

        let isCorrect = (cleanUser === cleanCorrect) || (normUser.length > 0 && normUser === normCorrect);
        if (!isCorrect && riddle.acceptedAnswers) {
            isCorrect = riddle.acceptedAnswers.some(ans => String(ans).trim().toUpperCase() === cleanUser || this.normalizeAnswer(ans) === normUser);
        }

        if (isCorrect) {
            this.playAudioTone('success');
            UI.vibrate([70, 50, 70]);
            fb.style.color = "#22c55e";

            // Wenn Wegweiser gelöst wurde:
            if (!isRouteDone && st.routeRiddle) {
                if (!prog.routeSolved) prog.routeSolved = {};
                prog.routeSolved[st.id] = true;
                this.saveProgress();
                fb.innerText = "Zielort enttarnt! Pin auf der Karte aktiviert.";
                setTimeout(() => {
                    this.renderStation();
                    this.initOrUpdateMap();
                }, 800);
                return;
            }

            // Haupträtsel vor Ort gelöst:
            fb.innerText = "Richtig gelöst! Akte aktualisiert.";
            if (!prog.unlocked.includes(st.id)) prog.unlocked.push(st.id);

            setTimeout(() => {
                if (prog.station < g.stations.length) {
                    prog.station++;
                    this.saveProgress();
                    this.renderStation();
                    this.renderDossier();
                } else {
                    this.showVictoryScreen();
                }
            }, 800);
        } else {
            this.playAudioTone('error');
            UI.vibrate(200);
            this.failedAttempts++;
            fb.style.color = "var(--accent)";
            fb.innerText = "Leider falsch! Versucht es noch einmal.";
            const hints = this.getStationHints(st);
            if (this.failedAttempts >= 3 && hints.length > 0) {
                this.updateAutoHintUI(st);
            }
        }
    },

    getStationHints(st) {
        if (!st) return [];
        const r = st.siteRiddle || st.riddle;
        if (!r) return [];
        if (Array.isArray(r.hints) && r.hints.length > 0) return r.hints.filter(h => !!h);
        if (r.hint) return [r.hint];
        return [];
    },

    updateAutoHintUI(st) {
        const hints = this.getStationHints(st);
        const box = document.getElementById('auto-hint-box');
        if (!box) return;

        if (hints.length === 0) {
            box.classList.add('hidden');
            return;
        }

        const prog = this.gameProgress[this.activeGameId];
        if (!prog) return;
        prog.revealedHints = prog.revealedHints || {};
        const revealedCount = prog.revealedHints[st.id] || 0;

        const status = document.getElementById('auto-hint-status');
        const btn = document.getElementById('btn-show-hint');
        const lbl = document.getElementById('lbl-show-hint');
        const txt = document.getElementById('auto-hint-text');

        box.classList.remove('hidden');

        if (revealedCount < hints.length) {
            if (status) status.innerText = `💡 Braucht ihr Hilfe? (${revealedCount} von ${hints.length} Hinweisen aufgedeckt):`;
            if (btn) btn.classList.remove('hidden');
            if (lbl) lbl.innerText = revealedCount === 0 ? "Ersten Tipp anzeigen" : `Nächsten Tipp anzeigen (${revealedCount + 1}/${hints.length})`;
        } else {
            if (status) status.innerText = "Alle verfügbaren Tipps aufgedeckt:";
            if (btn) btn.classList.add('hidden');
        }

        if (revealedCount > 0 && txt) {
            txt.classList.remove('hidden');
            txt.innerHTML = hints.slice(0, revealedCount).map((h, i) => `<strong>✦ Tipp ${i + 1}:</strong> ${h}`).join('<br><br>');
        } else if (txt) {
            txt.classList.add('hidden');
        }
    },

    revealAutoHint() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g.stations.find(s => s.id === prog.station);
        const hints = this.getStationHints(st);
        if (hints.length === 0) return;

        prog.revealedHints = prog.revealedHints || {};
        const current = prog.revealedHints[st.id] || 0;
        if (current < hints.length) {
            prog.revealedHints[st.id] = current + 1;
            this.saveProgress();
        }
        this.updateAutoHintUI(st);
        UI.vibrate(50);
    },

    confirmRevealSolution() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g.stations.find(s => s.id === prog.station);
        const r = st.siteRiddle || st.riddle;

        this.timerSeconds += 600;
        prog.penalties = (prog.penalties || 0) + 10;
        this.saveProgress();

        const box = document.getElementById('walkthrough-solution-box');
        if (box) {
            box.innerText = `Lösung für Station ${st.id}: ${r.answer}`;
            box.classList.remove('hidden');
        }
        document.getElementById('btn-reveal-solution')?.classList.add('hidden');
        document.getElementById('btn-advance-solution')?.classList.remove('hidden');
        alert("⚠️ 10 Minuten Strafzeit auf der Missionsuhr addiert!");
    },

    applySolutionAndAdvance() {
        UI.closeWalkthrough();
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g.stations.find(s => s.id === prog.station);

        this.playAudioTone('success');
        UI.vibrate([70, 50, 70]);
        this.failedAttempts = 0;

        if (!prog.unlocked.includes(st.id)) prog.unlocked.push(st.id);

        if (prog.station < g.stations.length) {
            prog.station++;
            this.saveProgress();
            this.renderStation();
            this.renderDossier();
            UI.showView('view-station');
        } else {
            this.showVictoryScreen();
        }
    },

    renderChronicle() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const container = document.getElementById('view-story');
        if (!container || !g) return;

        let medHTML = `
            <div style="text-align:center; padding:16px;">
                <h2 style="color:var(--accent);">Das Ahnensiegel</h2>
                <div style="font-size:3rem; margin:10px 0;">🔮</div>
                <p style="font-size:0.85rem; color:var(--text-muted);">Das Siegel bündelt sich mit jedem gelösten Rätsel.</p>
            </div>
        `;

        if (g.prologue && g.prologue.questions) {
            medHTML += `<h3 style="margin-top:16px; border-bottom:1px solid var(--border); padding-bottom:6px;">Aufgedeckte Vorgeschichte:</h3>`;
            const max = prog.stage === 'stations' ? g.prologue.questions.length : (prog.prologueIdx || 0);
            for (let i = 0; i < max; i++) {
                const q = g.prologue.questions[i];
                medHTML += `
                    <div style="background:rgba(128,128,128,0.06); padding:10px; border-radius:8px; margin-top:8px;">
                        <strong>${q.title}</strong><br><small style="color:var(--text-muted);">${q.storyUnlocked}</small>
                    </div>
                `;
            }
        }
        container.innerHTML = medHTML;
    },

    /* ========================================================
       4. SIMULIERTER ANRUF
       ======================================================== */
    triggerSimulatedCall(callerName, voiceMessage) {
        this.incomingCallData = { callerName, voiceMessage };
        document.getElementById('call-caller-name').innerText = callerName;
        document.getElementById('call-status-label').innerText = "Eingehender Funkspruch...";
        document.getElementById('call-action-btns')?.classList.remove('hidden');
        document.getElementById('call-overlay')?.classList.add('active');

        UI.vibrate([500, 200, 500, 200, 500]);
        this.startRingtone();
    },

    getAudioContext() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    },

    startRingtone() {
        try {
            const ctx = this.getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            this.ringtoneOsc = osc;
        } catch(e){}
    },

    stopRingtone() {
        if (this.ringtoneOsc) {
            try { this.ringtoneOsc.stop(); this.ringtoneOsc.disconnect(); } catch(e){}
            this.ringtoneOsc = null;
        }
    },

    acceptCall() {
        this.stopRingtone();
        document.getElementById('call-status-label').innerText = "Verbunden...";
        const btns = document.getElementById('call-action-btns');
        if (btns) {
            btns.innerHTML = `
                <button onclick="App.rejectCall()" class="icon-btn" style="width:65px; height:65px; background:#ef4444; color:#fff;">
                    <span class="material-symbols-rounded" style="font-size:32px;">call_end</span>
                </button>
            `;
        }

        if ('speechSynthesis' in window && this.incomingCallData?.voiceMessage) {
            const utter = new SpeechSynthesisUtterance(this.incomingCallData.voiceMessage);
            utter.lang = 'de-DE';
            utter.pitch = 0.8;
            utter.rate = 0.95;
            utter.onend = () => this.rejectCall();
            window.speechSynthesis.speak(utter);
        } else {
            setTimeout(() => this.rejectCall(), 6000);
        }
    },

    rejectCall() {
        this.stopRingtone();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        document.getElementById('call-overlay')?.classList.remove('active');
    },

    playAudioTone(type) {
        try {
            const ctx = this.getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                osc.start(); osc.stop(ctx.currentTime + 0.3);
            } else {
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
                osc.start(); osc.stop(ctx.currentTime + 0.25);
            }
        } catch(e){}
    },

    /* ========================================================
       5. MAP & GPS-PUNKT
       ======================================================== */
    initOrUpdateMap() {
        const g = this.getActiveGame();
        if (!g) return;

        const prog = this.gameProgress[this.activeGameId];
        const currentStation = g.stations.find(s => s.id === prog.station) || g.stations[0];
        const centerCoords = currentStation.coords || [51.8732, 11.0425];

        if (!leafletMap) {
            leafletMap = L.map('game-map').setView(centerCoords, 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(leafletMap);
        } else {
            leafletMap.invalidateSize();
            leafletMap.setView(centerCoords, 13);
        }

        mapMarkers.forEach(m => leafletMap.removeLayer(m));
        mapMarkers = [];

        g.stations.forEach(s => {
            const isRouteUnlocked = prog.routeSolved && prog.routeSolved[s.id];
            if (s.coords && (isRouteUnlocked || s.id < prog.station)) {
                const marker = L.marker(s.coords).addTo(leafletMap);
                marker.bindPopup(`<b>${s.roman}: ${s.title}</b><br>${s.targetLocation || s.location}`);
                mapMarkers.push(marker);
            }
        });
    },

    startCompass() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const btn = document.getElementById('btn-compass-perm');
            if (btn) btn.style.display = 'inline-block';
        }

        let lastHeading = null;
        const handleOrient = (e) => {
            let heading = e.webkitCompassHeading ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null);
            if (heading !== null && !isNaN(heading)) {
                if (lastHeading === null) lastHeading = heading;
                else {
                    let diff = heading - lastHeading;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    lastHeading = (lastHeading + diff * 0.2 + 360) % 360;
                }

                const deg = Math.round(lastHeading);
                const degEl = document.getElementById('compass-deg');
                const dirEl = document.getElementById('compass-dir');
                if (degEl && dirEl) {
                    degEl.innerText = deg + "°";
                    const dirs = ["Norden", "Nord-Ost", "Osten", "Süd-Ost", "Süden", "Süd-West", "Westen", "Nord-West"];
                    dirEl.innerText = dirs[Math.round(deg / 45) % 8];
                }
            }
        };

        if ('ondeviceorientationabsolute' in window) {
            compassWatchId = handleOrient;
            window.addEventListener('deviceorientationabsolute', compassWatchId, true);
        } else if (window.DeviceOrientationEvent) {
            compassWatchId = handleOrient;
            window.addEventListener('deviceorientation', compassWatchId, true);
        }
    },

    requestCompassPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(state => {
                if (state === 'granted') {
                    const btn = document.getElementById('btn-compass-perm');
                    if (btn) btn.style.display = 'none';
                    this.startCompass();
                } else alert("Zugriff verweigert.");
            }).catch(console.error);
        }
    },

    startGpsTracking() {
        if (!navigator.geolocation) return;
        gpsWatchId = navigator.geolocation.watchPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            if (leafletMap) {
                if (!userLocationMarker) {
                    userLocationMarker = L.circleMarker([lat, lng], {
                        radius: 8, fillColor: "#3b82f6", color: "#ffffff", weight: 2, fillOpacity: 0.9
                    }).addTo(leafletMap).bindPopup("Dein Live-Standort");
                } else {
                    userLocationMarker.setLatLng([lat, lng]);
                }
            }

            const g = this.getActiveGame();
            const prog = this.gameProgress[this.activeGameId];
            if (g && prog && prog.stage === 'stations') {
                const st = g.stations.find(s => s.id === prog.station);
                if (st && st.coords && st.unlock?.geofenceRadius) {
                    const dist = this.calcDistance(lat, lng, st.coords[0], st.coords[1]);
                    if (!prog.geofencesTriggered) prog.geofencesTriggered = [];
                    if (dist <= st.unlock.geofenceRadius && !prog.geofencesTriggered.includes(st.id)) {
                        prog.geofencesTriggered.push(st.id);
                        this.saveProgress();
                        UI.vibrate([100, 100, 100]);
                        alert(`📍 Ziel erreicht: Ihr seid am Ort '${st.title}' angekommen!`);
                        this.renderStation();
                    }
                }
            }
        }, null, { enableHighAccuracy: true });
    },

    calcDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    async requestWakeLock() {
        try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
    },

    async toggleTorch() {
        try {
            if (!videoTrack) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                videoTrack = stream.getVideoTracks()[0];
                await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
                document.getElementById('btn-tool-torch').style.borderColor = 'var(--accent)';
                document.getElementById('lbl-tool-torch').innerText = 'Taschenlampe (Ein)';
            } else {
                videoTrack.stop();
                videoTrack = null;
                document.getElementById('btn-tool-torch').style.borderColor = 'var(--border)';
                document.getElementById('lbl-tool-torch').innerText = 'Taschenlampe (Aus)';
            }
        } catch(err) { alert("Blitzlicht nicht verfügbar."); }
    },

    handleScannedCode(text) {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        const st = g?.stations.find(s => s.id === prog.station);

        if (st && st.unlock && (st.unlock.qrCode === text || text.includes(st.unlock.qrCode))) {
            if (!prog.geofencesTriggered) prog.geofencesTriggered = [];
            prog.geofencesTriggered.push(st.id);
            this.saveProgress();
            alert("✅ Vor-Ort-QR-Code erkannt: Station freigeschaltet!");
            this.renderStation();
        } else {
            alert(`Gescannter Code: ${text}`);
        }
    },

    /* ========================================================
       6. FINALE: URKUNDE, EPILOG & KONFETTI
       ======================================================== */
    showVictoryScreen() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];

        this.timerRunning = false;
        prog.completed = true;
        this.saveProgress();
        clearInterval(this.timerInterval);

        let rank = "Rang S: Meisterin des Wissens";
        if (prog.penalties > 10 || this.timerSeconds > 7200) rank = "Rang A: Erfahrene Ermittler";
        if (prog.penalties > 20 || this.timerSeconds > 10800) rank = "Rang B: Tapfere Sucher";

        document.getElementById('vic-game-title').innerText = g.title;
        document.getElementById('vic-rank-badge').innerText = rank;
        document.getElementById('vic-time').innerText = this.formatSeconds(this.timerSeconds);
        document.getElementById('vic-penalties').innerText = (prog.penalties || 0) + " Minuten";
        document.getElementById('vic-station-count').innerText = `${g.stations.length} Stationen`;
        document.getElementById('vic-date').innerText = new Date().toLocaleDateString('de-DE');

        this.launchConfetti();
        this.renderCertificateCanvas(g, rank);

        const epBox = document.getElementById('vic-epilogue-box');
        if (g.epilogue) {
            epBox?.classList.remove('hidden');
            const epWrap = document.getElementById('vic-epilogue-video-wrap');
            if (epWrap) {
                epWrap.innerHTML = `
                    <div style="background:rgba(0,0,0,0.4); padding:16px; border-radius:12px; border-left:3px solid var(--accent); margin-bottom:12px;">
                        <h3 style="color:var(--accent); font-size:1.1rem;">${g.epilogue.title}</h3>
                        <p style="font-size:0.9rem; line-height:1.6; margin-top:8px;">${g.epilogue.storyText}</p>
                    </div>
                `;
            }
            this.playNarrative(g.epilogue.audio, g.epilogue.ttsText);
        } else if (g.epilogueVideo) {
            epBox?.classList.remove('hidden');
            const epWrap = document.getElementById('vic-epilogue-video-wrap');
            if (epWrap) epWrap.innerHTML = `<video controls src="${g.epilogueVideo}" style="width:100%;"></video>`;
        } else {
            epBox?.classList.add('hidden');
        }

        UI.showView('view-victory');
    },

    renderCertificateCanvas(game, rank) {
        const canvas = document.getElementById('cert-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const drawText = () => {
            ctx.fillStyle = game.theme?.accent || "#2e7d32";
            ctx.font = "bold 26px serif";
            ctx.textAlign = "center";
            ctx.fillText("EHREN-URKUNDE", 300, 65);

            ctx.fillStyle = "#ffffff";
            ctx.font = "18px sans-serif";
            ctx.fillText(game.title, 300, 110);

            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 22px sans-serif";
            ctx.fillText(rank, 300, 165);

            ctx.fillStyle = "#dddddd";
            ctx.font = "14px sans-serif";
            ctx.fillText(`Erfolgreich abgeschlossen am ${new Date().toLocaleDateString('de-DE')}`, 300, 220);
            ctx.fillText(`Gesamtzeit: ${this.formatSeconds(this.timerSeconds)}`, 300, 250);

            ctx.fillStyle = game.theme?.accent || "#2e7d32";
            ctx.font = "bold 13px sans-serif";
            ctx.fillText("✦ Das verschwundene Wissen ✦", 300, 350);
        };

        if (game.certificateTemplate) {
            const bgImg = new Image();
            bgImg.crossOrigin = "anonymous";
            bgImg.onload = () => {
                ctx.drawImage(bgImg, 0, 0, 600, 400);
                drawText();
            };
            bgImg.onerror = () => {
                ctx.fillStyle = "#0b1017";
                ctx.fillRect(0, 0, 600, 400);
                drawText();
            };
            bgImg.src = game.certificateTemplate;
        } else {
            ctx.fillStyle = "#0b1017";
            ctx.fillRect(0, 0, 600, 400);
            drawText();
        }
    },

    downloadCertificate() {
        const canvas = document.getElementById('cert-canvas');
        const link = document.createElement('a');
        link.download = `Urkunde-${this.activeGameId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    launchConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let particles = Array.from({ length: 60 }).map(() => ({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height,
            size: Math.random() * 8 + 4,
            color: ['#2e7d32', '#c9a050', '#ffffff', '#22c55e'][Math.floor(Math.random()*4)],
            speed: Math.random() * 3 + 2
        }));

        let frames = 0;
        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speed;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            frames++;
            if (frames < 180) requestAnimationFrame(render);
            else ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        render();
    },

    /* ========================================================
       7. HARDWARE, TIMER & ALLGEMEINES
       ======================================================== */
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerRunning = true;
        this.timerInterval = setInterval(() => {
            if (this.timerRunning) {
                this.timerSeconds++;
                this.updateTimerDisplay();
                if (this.activeGameId && this.gameProgress[this.activeGameId]) {
                    this.gameProgress[this.activeGameId].timerSeconds = this.timerSeconds;
                    if (this.timerSeconds % 10 === 0) this.saveProgress();
                }
            }
        }, 1000);
    },
    toggleTimer() {
        this.timerRunning = !this.timerRunning;
        const icon = document.getElementById('timer-btn-icon');
        if (icon) icon.innerText = this.timerRunning ? 'pause' : 'play_arrow';
    },
    updateTimerDisplay() {
        const el = document.getElementById('timer-display');
        if (el) el.innerText = this.formatSeconds(this.timerSeconds);
    },
    formatSeconds(sec) {
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    },

    initCanvas() {
        const canvas = document.getElementById('sketch-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let painting = false;

        const saved = localStorage.getItem('escape_canvas_img');
        if (saved) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = saved; }

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : null;
            const cx = touch ? touch.clientX : e.clientX;
            const cy = touch ? touch.clientY : e.clientY;
            return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
        }

        const saveSketch = () => {
            try { localStorage.setItem('escape_canvas_img', canvas.toDataURL('image/png', 0.7)); } catch(e){}
        };

        canvas.onmousedown = (e) => { painting = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
        canvas.onmousemove = (e) => { if (!painting) return; const p = getPos(e); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineTo(p.x, p.y); ctx.stroke(); };
        canvas.onmouseup = () => { painting = false; saveSketch(); };

        canvas.ontouchstart = (e) => { painting = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
        canvas.ontouchmove = (e) => { if (!painting) return; e.preventDefault(); const p = getPos(e); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineTo(p.x, p.y); ctx.stroke(); };
        canvas.ontouchend = () => { painting = false; saveSketch(); };
    },
    clearCanvas() {
        const canvas = document.getElementById('sketch-canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        localStorage.removeItem('escape_canvas_img');
    },
    saveNotes(text) { localStorage.setItem('escape_notes_text', text); },

    renderDossier() {
        const list = document.getElementById('dossier-items');
        if (!list) return;
        list.innerHTML = "";
        const g = this.getActiveGame();
        if (!g) return;
        const prog = this.gameProgress[this.activeGameId];

        if (!prog || prog.unlocked.length === 0) {
            list.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem;'>Noch keine Fundstücke geborgen.</p>";
            return;
        }

        prog.unlocked.forEach(id => {
            const st = g.stations.find(s => s.id === id);
            if (st && st.dossier) {
                const div = document.createElement('div');
                div.style = "background:rgba(128,128,128,0.06); border-left:3px solid var(--accent); padding:12px; margin-bottom:10px; border-radius:8px;";
                div.innerHTML = `<strong>${st.dossier.title}</strong><br><small style="color:var(--text-muted);">${st.targetLocation || st.location}</small><p style="margin-top:4px; font-size:0.9rem;">${st.dossier.text}</p>`;
                list.appendChild(div);
            }
        });
    },

    updateMenu() {
        const inGame = !!this.activeGameId && !!this.activeRole;
        document.getElementById('menu-hub-content')?.classList.toggle('hidden', inGame);
        document.getElementById('menu-game-content')?.classList.toggle('hidden', !inGame);

        const status = document.getElementById('menu-user-status');
        if (status) {
            status.innerHTML = inGame ? `Eingeloggt: <strong>${this.activeRole.name}</strong>` : "Kein Spiel geöffnet";
        }
        if (inGame) this.renderAdminJumps();
    },

    leaveGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (videoTrack) { videoTrack.stop(); videoTrack = null; }
        if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
        if (wakeLock) wakeLock.release().catch(()=>{});

        UI.resetDefaultTheme();
        this.saveProgress();
        this.activeGameId = null;
        this.activeRole = null;
        this.sandboxGame = null;
        this.updateMenu();
        this.showHome();
        UI.toggle('menu-panel');
    },

    sendHint() {
        const input = document.getElementById('hueter-hint-input');
        if (!input) return;
        const v = input.value.trim();
        if (!v || !this.activeGameId || !this.gameProgress[this.activeGameId]) return;
        this.gameProgress[this.activeGameId].hint = v;
        this.saveProgress();
        this.renderLiveHint();
        alert("Tipp übertragen!");
        input.value = "";
    },

    sendAdminHint() {
        const input = document.getElementById('admin-hint-input') || document.getElementById('hueter-hint-input');
        if (!input) return;
        const v = input.value.trim();
        if (!v || !this.activeGameId || !this.gameProgress[this.activeGameId]) return;
        this.gameProgress[this.activeGameId].hint = v;
        this.saveProgress();
        this.renderLiveHint();
        alert("Spielleiter-Tipp gefunkt!");
        input.value = "";
    },

    adminUnlockAll() {
        const g = this.getActiveGame();
        const prog = this.gameProgress[this.activeGameId];
        g.stations.forEach(s => {
            if (!prog.unlocked.includes(s.id)) prog.unlocked.push(s.id);
        });
        this.saveProgress();
        this.renderDossier();
        alert("Alle Aktenstücke freigeschaltet!");
    },

    clearHint() {
        if (this.activeGameId && this.gameProgress[this.activeGameId]) {
            this.gameProgress[this.activeGameId].hint = null;
            this.saveProgress();
            this.renderLiveHint();
        }
    },

    renderLiveHint() {
        const b = document.getElementById('live-hint-bar');
        const prog = this.gameProgress[this.activeGameId];
        if (prog && prog.hint && b) {
            b.classList.remove('hidden');
            document.getElementById('live-hint-text').innerText = prog.hint;
        } else if (b) {
            b.classList.add('hidden');
        }
    },

    renderAdminJumps() {
        if (!this.activeGameId) return;
        const g = this.getActiveGame();
        const box = document.getElementById('admin-jump-list');
        if (!box) return;
        box.innerHTML = "";

        const titleEl = document.getElementById('admin-game-title');
        if (titleEl) titleEl.innerText = g.title;

        g.stations.forEach(st => {
            const btn = document.createElement('button');
            btn.className = "btn-sub";
            btn.innerText = st.roman || `St. ${st.id}`;
            btn.onclick = () => {
                this.gameProgress[this.activeGameId].station = st.id;
                this.gameProgress[this.activeGameId].stage = 'stations';
                if (!this.gameProgress[this.activeGameId].unlocked.includes(st.id)) {
                    this.gameProgress[this.activeGameId].unlocked.push(st.id);
                }
                this.saveProgress();
                this.renderStation();
                this.renderDossier();
                UI.showView('view-station');
            };
            box.appendChild(btn);
        });
    },

    resetCurrentMission() {
        const g = this.getActiveGame();
        if (confirm(`Möchtest du '${g.title}' komplett auf Station I zurücksetzen?`)) {
            this.timerSeconds = 0;
            this.updateTimerDisplay();
            this.gameProgress[this.activeGameId] = { 
                stage: 'prologue',
                prologueIdx: 0,
                station: 1, 
                routeSolved: {},
                unlocked: [], 
                hint: null, 
                penalties: 0, 
                geofencesTriggered: [], 
                timerSeconds: 0, 
                revealedHints: {} 
            };
            this.saveProgress();
            this.renderStation();
            this.renderDossier();
            this.renderLiveHint();
            alert("Mission zurückgesetzt.");
            UI.showView('view-station');
        }
    },

    /* ========================================================
       8. MASTER-ADMIN CONSOLE (CODE: 15011989)
       ======================================================== */
    promptDevAccess() {
        const entered = prompt("Autorisierung erforderlich. Master-Schlüssel eingeben:");
        if (!entered) return;
        if (String(entered).trim() === "15011989") {
            UI.toggle('settings-panel');
            UI.showView('view-dev-studio');
        } else {
            alert("Zugriff verweigert: Ungültiger Master-Code.");
        }
    },

    devValidateAndSandbox() {
        const fi = document.getElementById('dev-file-input');
        const report = document.getElementById('dev-report-box');

        if (!fi.files || fi.files.length === 0) return alert("Bitte wähle eine .json-Datei aus!");

        const r = new FileReader();
        r.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                let errors = [];

                if (!json.id) errors.push("Fehlt: 'id'");
                if (!json.title) errors.push("Fehlt: 'title'");
                if (!json.roles || !json.roles.player || !json.roles.admin) {
                    errors.push("Fehlt: 'roles' mit mindestens 'player' und 'admin'");
                }
                if (!json.stations || !Array.isArray(json.stations) || json.stations.length === 0) {
                    errors.push("Fehlt: 'stations' Array");
                }

                report.classList.remove('hidden');

                if (errors.length > 0) {
                    report.innerHTML = `<span style="color:#ef4444; font-weight:bold;">❌ Fehler:</span><br>` + errors.join('<br>');
                } else {
                    this.sandboxGame = json;
                    report.innerHTML = `<span style="color:#22c55e; font-weight:bold;">✅ Perfekt validiert!</span><br>Starte Testlauf in der Sandbox...`;
                    setTimeout(() => this.openGameMenu(json.id), 800);
                }
            } catch(err) {
                report.classList.remove('hidden');
                report.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Syntax-Fehler:</span><br>${err.message}`;
            }
        };
        r.readAsText(fi.files[0]);
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());