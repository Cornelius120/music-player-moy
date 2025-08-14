document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // KONFIGURASI PENTING
    // =================================================================
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyv0qyQ4rD2tvNoug7oeMefaU57zydf-uG0dn2djrKhAC6Z5AveE6d97Z3RXnmrWOU/exec";

    // GANTI DENGAN KONFIGURASI FIREBASE ANDA!
    const firebaseConfig = {
      apiKey: "AIzaSyCsp_kXBk_rV7hVtSAuVUXl-CK_-NkTPKY",
      authDomain: "pemutar-musik-blog.firebaseapp.com",
      projectId: "pemutar-musik-blog",
      storageBucket: "pemutar-musik-blog.firebasestorage.app",
      messagingSenderId: "9523961810",
      appId: "1:9523961810:web:02be84fbbc6b746a84b20b"
    };

    // =================================================================
    // STATE APLIKASI
    // =================================================================
    let state = {
        currentPlaylistId: null,
        currentSongIndex: 0,
        isPlaying: false,
        isLoop: false,
        isShuffle: false,
        songsData: {},
        currentPlaylist: [],
        originalPlaylistOrder: [],
        currentUser: null // Untuk menyimpan info user Firebase
    };

    // =================================================================
    // Inisialisasi Firebase
    // =================================================================
    const fbApp = firebase.initializeApp(firebaseConfig);
    const fbAuth = firebase.auth();
    const fbDb = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // =================================================================
    // ELEMEN DOM
    // =================================================================
    const dom = {
        // ... (semua elemen DOM lama tetap di sini) ...
        views: { playlist: document.getElementById('playlist-view'), player: document.getElementById('player-view') },
        audioPlayer: new Audio(),
        playlistGrid: document.querySelector('.b-player-playlist-grid'),
        backToPlaylistsBtn: document.getElementById('back-to-playlists-btn'),
        playerThumbnail: document.getElementById('player-thumbnail'),
        playerSongTitle: document.getElementById('player-song-title'),
        playerSongArtist: document.getElementById('player-song-artist'),
        playerSongGenre: document.getElementById('player-song-genre'),
        copySongLinkBtn: document.getElementById('copy-song-link-btn'),
        likeBtn: document.getElementById('like-btn'),
        likeCount: document.getElementById('like-count'),
        dislikeBtn: document.getElementById('dislike-btn'),
        dislikeCount: document.getElementById('dislike-count'),
        authContainer: document.getElementById('auth-container'),
        loginBtn: document.getElementById('login-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        userNameDisplay: document.getElementById('user-name-display'),
        progressBar: document.getElementById('progress-bar'),
        progressContainer: document.querySelector('.b-player-progress-container'),
        currentTime: document.getElementById('current-time'),
        duration: document.getElementById('duration'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        playIcon: document.getElementById('play-icon'),
        pauseIcon: document.getElementById('pause-icon'),
        nextBtn: document.getElementById('next-btn'),
        prevBtn: document.getElementById('prev-btn'),
        loopBtn: document.getElementById('loop-btn'),
        shuffleBtn: document.getElementById('shuffle-btn'),
        tabButtons: document.querySelectorAll('.b-player-tab-btn'),
        tabContents: document.querySelectorAll('.b-player-tab-content'),
        songlistContainer: document.getElementById('songlist-container'),
        lyricsContainer: document.getElementById('lyrics-container'),
        commentsContainer: document.getElementById('comments-container'),
        commentCount: document.getElementById('comment-count'),
        commentForm: document.getElementById('comment-form'),
        editorToolbar: document.getElementById('editor-toolbar'),
        parentCommentIdInput: document.getElementById('parent_comment_id'),
        commentContentInput: document.querySelector('#comment-form textarea[name="comment_content"]'),
        toastNotification: document.getElementById('toast-notification')
    };

    // =================================================================
    // FUNGSI UTAMA & FIREBASE
    // =================================================================

    async function init() {
        console.log("Memulai Pemutar Musik v5.0 (Firebase)...");
        setupAuthObserver();
        // ... (sisa fungsi init tetap sama) ...
        loadStateFromStorage();
        renderPlaylists();
        
        const urlParams = new URLSearchParams(window.location.search);
        const playlistIdParam = urlParams.get('playlist');
        const songIdParam = urlParams.get('song');
        
        if (playlistIdParam) {
            const playlist = musicDatabase.playlists.find(p => p.id === playlistIdParam);
            if (playlist) switchToPlayerView(playlist, songIdParam);
        } else if (state.currentPlaylistId) {
            const playlist = musicDatabase.playlists.find(p => p.id === state.currentPlaylistId);
            if (playlist) switchToPlayerView(playlist);
            else switchToPlaylistView();
        } else {
            switchToPlaylistView();
        }
        
        setupEventListeners();
        console.log("Pemutar Musik Siap.");
    }

    function setupAuthObserver() {
        fbAuth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in.
                state.currentUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                };
                dom.loginBtn.style.display = 'none';
                dom.logoutBtn.style.display = 'block';
                dom.userNameDisplay.textContent = `Halo, ${user.displayName.split(' ')[0]}`;
            } else {
                // User is signed out.
                state.currentUser = null;
                dom.loginBtn.style.display = 'block';
                dom.logoutBtn.style.display = 'none';
                dom.userNameDisplay.textContent = '';
            }
            // Refresh interaction display whenever auth state changes
            if (state.currentPlaylistId) {
                const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
                fetchSongInteractions(songId);
            }
        });
    }

    function handleLogin() {
        fbAuth.signInWithPopup(googleProvider).catch(error => {
            console.error("Login Gagal:", error);
            alert("Gagal login dengan Google. Silakan coba lagi.");
        });
    }

    function handleLogout() {
        fbAuth.signOut();
    }
    
    // --- FUNGSI INTERAKSI DENGAN FIREBASE ---

    async function fetchSongInteractions(songId) {
        const docRef = fbDb.collection("song_interactions").doc(songId);
        docRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                state.songsData[songId] = {
                    likes: data.likes || [],
                    dislikes: data.dislikes || []
                };
            } else {
                state.songsData[songId] = { likes: [], dislikes: [] };
            }
            updateInteractionDisplay(songId);
        });
    }

    async function postInteraction(songId, type) {
        if (!state.currentUser) {
            alert("Silakan login untuk memberikan like atau dislike.");
            return;
        }

        const docRef = fbDb.collection("song_interactions").doc(songId);
        const userUid = state.currentUser.uid;
        const likeField = `likes`;
        const dislikeField = `dislikes`;

        fbDb.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            let likes = [];
            let dislikes = [];

            if (doc.exists) {
                likes = doc.data().likes || [];
                dislikes = doc.data().dislikes || [];
            }

            if (type === 'like') {
                // Handle Like
                if (dislikes.includes(userUid)) transaction.update(docRef, { [dislikeField]: firebase.firestore.FieldValue.arrayRemove(userUid) });
                if (likes.includes(userUid)) transaction.update(docRef, { [likeField]: firebase.firestore.FieldValue.arrayRemove(userUid) });
                else transaction.set(docRef, { [likeField]: firebase.firestore.FieldValue.arrayUnion(userUid) }, { merge: true });
            } else {
                // Handle Dislike
                if (likes.includes(userUid)) transaction.update(docRef, { [likeField]: firebase.firestore.FieldValue.arrayRemove(userUid) });
                if (dislikes.includes(userUid)) transaction.update(docRef, { [dislikeField]: firebase.firestore.FieldValue.arrayRemove(userUid) });
                else transaction.set(docRef, { [dislikeField]: firebase.firestore.FieldValue.arrayUnion(userUid) }, { merge: true });
            }
        }).catch(error => {
            console.error("Transaksi Gagal: ", error);
        });
    }
    
    // --- FUNGSI RENDER (DIPERBARUI) ---
    
    function updateInteractionDisplay(songId) {
        const data = state.songsData[songId] || { likes: [], dislikes: [] };
        dom.likeCount.textContent = data.likes.length;
        dom.dislikeCount.textContent = data.dislikes.length;
        
        if(state.currentUser) {
            dom.likeBtn.classList.toggle('active', data.likes.includes(state.currentUser.uid));
            dom.dislikeBtn.classList.toggle('active', data.dislikes.includes(state.currentUser.uid));
        } else {
            dom.likeBtn.classList.remove('active');
            dom.dislikeBtn.classList.remove('active');
        }
    }

    function updateSongDisplay(song) {
        // ... (fungsi ini tetap sama, tapi sekarang memanggil fetchSongInteractions) ...
        dom.playerThumbnail.src = song.thumbnail;
        dom.playerSongTitle.textContent = song.title;
        dom.playerSongArtist.textContent = song.artist;
        dom.playerSongGenre.textContent = song.genre;
        dom.lyricsContainer.textContent = song.lyrics || "Lirik tidak tersedia untuk lagu ini.";
        document.querySelectorAll('.b-player-song-item').forEach(item => item.classList.toggle('playing', item.dataset.songId === song.id));
        
        // Panggil fungsi Firebase & Google Sheets
        fetchSongInteractions(song.id); // BARU: Ambil data like/dislike dari Firebase
        fetchComments(song.id); // LAMA: Tetap ambil komentar dari Google Sheets
    }

    // --- SEMUA FUNGSI LAINNYA (Komentar, Player, dll) TETAP SAMA ---
    // ... (Salin semua fungsi lain dari script.js sebelumnya ke sini) ...
    // Pastikan fungsi setupEventListeners diperbarui
    function setupEventListeners() {
        // ... (semua event listener lama) ...
        dom.playPauseBtn.addEventListener('click', () => state.isPlaying ? pauseSong() : playSong());
        dom.nextBtn.addEventListener('click', nextSong);
        dom.prevBtn.addEventListener('click', prevSong);
        dom.loopBtn.addEventListener('click', () => {
            state.isLoop = !state.isLoop;
            dom.audioPlayer.loop = state.isLoop;
            dom.loopBtn.classList.toggle('active', state.isLoop);
            saveStateToStorage();
        });
        dom.shuffleBtn.addEventListener('click', toggleShuffle);
        dom.audioPlayer.addEventListener('timeupdate', updateProgress);
        dom.audioPlayer.addEventListener('loadedmetadata', updateProgress);
        dom.audioPlayer.addEventListener('ended', () => { if (!state.isLoop) nextSong(); });
        dom.audioPlayer.addEventListener('error', () => {
             console.warn(`Gagal memuat: ${dom.audioPlayer.currentSrc}`);
             currentSourceIndex++;
             tryLoadSource();
        });
        dom.progressContainer.addEventListener('click', setProgress);
        dom.backToPlaylistsBtn.addEventListener('click', switchToPlaylistView);
        dom.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                dom.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dom.tabContents.forEach(c => c.classList.remove('active'));
                document.getElementById(`${tab}-content`).classList.add('active');
            });
        });
        dom.copySongLinkBtn.addEventListener('click', () => {
            const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
            const url = `${window.location.origin}${window.location.pathname}?playlist=${state.currentPlaylistId}&song=${songId}`;
            navigator.clipboard.writeText(url).then(() => showToast('Link lagu tersalin!'));
        });
        dom.commentForm.addEventListener('submit', postComment);
        dom.editorToolbar.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const action = button.dataset.action;
            switch(action) {
                case 'bold': wrapTextInTextarea('**', '**', 'teks tebal'); break;
                case 'italic': wrapTextInTextarea('_', '_', 'teks miring'); break;
                case 'link': wrapTextInTextarea('[link:', '](URL_ANDA)'); break;
                case 'spoiler': wrapTextInTextarea('||', '||', 'spoiler'); break;
                case 'image': wrapTextInTextarea('[img]', '(URL_GAMBAR)'); break;
                case 'video': wrapTextInTextarea('[video]', '(URL_VIDEO)'); break;
            }
        });
        
        // EVENT LISTENER BARU
        dom.loginBtn.addEventListener('click', handleLogin);
        dom.logoutBtn.addEventListener('click', handleLogout);
        dom.likeBtn.addEventListener('click', () => {
            const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
            postInteraction(songId, 'like');
        });
        dom.dislikeBtn.addEventListener('click', () => {
            const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
            postInteraction(songId, 'dislike');
        });
    }
    
    // Sisa fungsi helper dan render (tidak berubah)
    function switchToPlaylistView() { dom.views.player.classList.remove('active'); dom.views.playlist.classList.add('active'); state.currentPlaylistId = null; saveStateToStorage(); }
    function renderPlaylists() { dom.playlistGrid.innerHTML = ''; musicDatabase.playlists.forEach(playlist => { const card = document.createElement('div'); card.className = 'b-player-playlist-card'; card.innerHTML = `<img src="${playlist.thumbnail}" alt="${playlist.name}" onerror="this.src='https://placehold.co/400x400/333/ccc?text=Error'"><h3>${playlist.name}</h3><p>${playlist.description}</p>`; card.addEventListener('click', () => switchToPlayerView(playlist)); dom.playlistGrid.appendChild(card); }); }
    function renderSonglist() { dom.songlistContainer.innerHTML = ''; state.currentPlaylist.forEach((song) => { const item = document.createElement('div'); item.className = 'b-player-song-item'; item.dataset.songId = song.id; item.innerHTML = `<img src="${song.thumbnail}" alt="${song.title}" onerror="this.src='https://placehold.co/40x40/333/ccc?text=S'"><div class="b-player-song-item-info"><h4>${song.title}</h4><p>${song.artist}</p></div>`; item.addEventListener('click', () => { const originalIndex = state.originalPlaylistOrder.findIndex(s => s.id === song.id); loadSong(originalIndex); }); dom.songlistContainer.appendChild(item); }); }
    function renderComments(comments) { dom.commentsContainer.innerHTML = ''; dom.commentCount.textContent = comments.length; if (comments.length === 0) { dom.commentsContainer.innerHTML = '<p style="color: #555;">Jadilah yang pertama berkomentar!</p>'; return; } const commentMap = {}; const rootComments = []; comments.forEach(c => { commentMap[c.comment_id] = { ...c, replies: [] }; }); comments.forEach(c => { if (c.parent_comment_id && commentMap[c.parent_comment_id]) { commentMap[c.parent_comment_id].replies.push(commentMap[c.comment_id]); } else { rootComments.push(commentMap[c.comment_id]); } }); rootComments.forEach(c => { dom.commentsContainer.appendChild(createCommentElement(c)); c.replies.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(r => dom.commentsContainer.appendChild(createCommentElement(r, true))); }); }
    function createCommentElement(comment, isReply = false) { const div = document.createElement('div'); div.className = `b-player-comment ${isReply ? 'is-reply' : ''}`; div.id = `comment-${comment.comment_id}`; const nameHTML = comment.user_website ? `<a href="${comment.user_website}" target="_blank" rel="noopener nofollow">${comment.user_name}</a>` : comment.user_name; const processedContent = comment.comment_content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\[link:(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>').replace(/\[img\]\((.*?)\)/g, '<img src="$1" alt="Gambar dari user" style="max-width:100%; border-radius:8px; margin-top:10px;">').replace(/\[video\]\((.*?)\)/g, '<video src="$1" controls style="max-width:100%; border-radius:8px; margin-top:10px;"></video>').replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.add(\'revealed\')">$1</span>'); div.innerHTML = `<img class="b-player-comment-avatar" src="${comment.user_avatar || 'https://placehold.co/40x40/555/ccc?text=U'}" onerror="this.src='https://placehold.co/40x40/555/ccc?text=U'"><div class="b-player-comment-body"><div class="b-player-comment-header"><span class="name">${nameHTML}</span><span class="time">${new Date(comment.timestamp).toLocaleString('id-ID')}</span></div><div class="b-player-comment-content">${processedContent}</div><div class="b-player-comment-actions"><span class="action-btn reply-btn" data-comment-id="${comment.comment_id}" data-user-name="${comment.user_name}">Balas</span><span class="action-btn copy-comment-btn" data-comment-id="${comment.comment_id}">Salin Link</span><span class="action-btn report-comment-btn" data-comment-id="${comment.comment_id}">Laporkan</span></div></div>`; div.querySelector('.reply-btn').addEventListener('click', (e) => { const target = e.currentTarget; dom.parentCommentIdInput.value = target.dataset.commentId; dom.commentContentInput.value = `@${target.dataset.userName} `; dom.commentContentInput.focus(); }); div.querySelector('.copy-comment-btn').addEventListener('click', (e) => { const commentId = e.currentTarget.dataset.commentId; const songId = state.originalPlaylistOrder[state.currentSongIndex].id; const url = `${window.location.origin}${window.location.pathname}?playlist=${state.currentPlaylistId}&song=${songId}&comment=${commentId}`; navigator.clipboard.writeText(url).then(() => showToast('Link komentar tersalin!')); }); div.querySelector('.report-comment-btn').addEventListener('click', (e) => { const commentId = e.currentTarget.dataset.commentId; const reason = prompt("Apa alasan Anda melaporkan komentar ini?"); if (reason) { const userEmail = prompt("Masukkan email Anda (opsional) untuk kami hubungi kembali:"); apiPost("reportComment", { comment_id: commentId, reason: reason, reporter_email: userEmail }).then(() => showToast('Laporan terkirim. Terima kasih.')); } }); return div; }
    function loadSong(index) { if (index < 0 || index >= state.originalPlaylistOrder.length) index = 0; state.currentSongIndex = index; const song = state.originalPlaylistOrder[index]; if (!song) return; updateSongDisplay(song); currentSourceIndex = 0; tryLoadSource(); saveStateToStorage(); }
    function tryLoadSource() { const song = state.originalPlaylistOrder[state.currentSongIndex]; if (currentSourceIndex < song.sources.length) { dom.audioPlayer.src = song.sources[currentSourceIndex]; if (state.isPlaying) dom.audioPlayer.play().catch(e => console.error("Gagal memutar otomatis:", e)); } else { console.error(`Semua sumber untuk lagu "${song.title}" gagal.`); if(state.isPlaying) setTimeout(nextSong, 1000); } }
    function playSong() { state.isPlaying = true; dom.audioPlayer.play(); dom.playIcon.style.display = 'none'; dom.pauseIcon.style.display = 'block'; }
    function pauseSong() { state.isPlaying = false; dom.audioPlayer.pause(); dom.playIcon.style.display = 'block'; dom.pauseIcon.style.display = 'none'; }
    function nextSong() { let nextIndex = state.isShuffle ? Math.floor(Math.random() * state.originalPlaylistOrder.length) : (state.currentSongIndex + 1) % state.originalPlaylistOrder.length; loadSong(nextIndex); }
    function prevSong() { let prevIndex = (state.currentSongIndex - 1 + state.originalPlaylistOrder.length) % state.originalPlaylistOrder.length; loadSong(prevIndex); }
    function updateProgress() { const { duration, currentTime } = dom.audioPlayer; if (duration) { const progressPercent = (currentTime / duration) * 100; dom.progressBar.style.width = `${progressPercent}%`; dom.currentTime.textContent = formatTime(currentTime); dom.duration.textContent = formatTime(duration); } }
    function setProgress(e) { const width = this.clientWidth; const clickX = e.offsetX; dom.audioPlayer.currentTime = (clickX / width) * dom.audioPlayer.duration; }
    function getShuffledPlaylist() { const currentSong = state.originalPlaylistOrder[state.currentSongIndex]; let shuffled = [...state.originalPlaylistOrder].sort(() => Math.random() - 0.5); if (currentSong) { shuffled = shuffled.filter(s => s.id !== currentSong.id); shuffled.unshift(currentSong); } return shuffled; }
    function toggleShuffle() { state.isShuffle = !state.isShuffle; dom.shuffleBtn.classList.toggle('active', state.isShuffle); state.currentPlaylist = state.isShuffle ? getShuffledPlaylist() : [...state.originalPlaylistOrder]; renderSonglist(); updateSongDisplay(state.originalPlaylistOrder[state.currentSongIndex]); saveStateToStorage(); }
    async function apiPost(action, payload) { try { const response = await fetch(GAS_URL, { method: 'POST', redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, payload }) }); return response.json(); } catch (error) { console.error(`API Post Error for action ${action}:`, error); return { error: error.message }; } }
    async function fetchComments(songId) { dom.commentsContainer.innerHTML = '<p style="color: #555;">Memuat komentar...</p>'; try { const response = await fetch(`${GAS_URL}?action=getComments&song_id=${songId}`); if (!response.ok) throw new Error("Gagal mengambil komentar"); const data = await response.json(); if (data.error) throw new Error(data.error); renderComments(data); } catch (error) { console.error("Error fetching comments:", error); dom.commentsContainer.innerHTML = '<p style="color: #d9534f;">Gagal memuat komentar.</p>'; } }
    async function postComment(e) { e.preventDefault(); const submitBtn = dom.commentForm.querySelector('button'); submitBtn.disabled = true; submitBtn.textContent = 'Mengirim...'; const formData = new FormData(dom.commentForm); const songId = state.originalPlaylistOrder[state.currentSongIndex].id; const commentData = { song_id: songId, user_name: formData.get('user_name'), user_avatar: formData.get('user_avatar'), user_website: formData.get('user_website'), user_email: formData.get('user_email'), comment_content: formData.get('comment_content'), parent_comment_id: formData.get('parent_comment_id') }; const result = await apiPost("postComment", commentData); if (result && result.status === 'sukses') { dom.commentForm.reset(); dom.parentCommentIdInput.value = ''; fetchComments(songId); } else { alert("Gagal mengirim komentar. Silakan coba lagi."); } submitBtn.disabled = false; submitBtn.textContent = 'Kirim Komentar'; }
    function saveStateToStorage() { const stateToSave = { currentPlaylistId: state.currentPlaylistId, currentSongIndex: state.currentSongIndex, isLoop: state.isLoop, isShuffle: state.isShuffle, volume: dom.audioPlayer.volume }; localStorage.setItem('bPlayerState', JSON.stringify(stateToSave)); }
    function loadStateFromStorage() { const savedState = localStorage.getItem('bPlayerState'); if (savedState) { const parsedState = JSON.parse(savedState); Object.assign(state, parsedState); dom.audioPlayer.loop = state.isLoop; dom.loopBtn.classList.toggle('active', state.isLoop); dom.shuffleBtn.classList.toggle('active', state.isShuffle); } }
    function formatTime(seconds) { if (isNaN(seconds)) return "0:00"; const minutes = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${minutes}:${secs < 10 ? '0' : ''}${secs}`; }
    function showToast(message) { dom.toastNotification.textContent = message; dom.toastNotification.classList.add('show'); setTimeout(() => { dom.toastNotification.classList.remove('show'); }, 3000); }
    function wrapTextInTextarea(before, after, placeholder = '') { const textarea = dom.commentContentInput; const start = textarea.selectionStart; const end = textarea.selectionEnd; const selectedText = textarea.value.substring(start, end); const newText = selectedText || placeholder; const text = `${textarea.value.substring(0, start)}${before}${newText}${after}${textarea.value.substring(end)}`; textarea.value = text; textarea.focus(); textarea.selectionStart = start + before.length; textarea.selectionEnd = textarea.selectionStart + newText.length; }
    
    init();
});
