document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI PENTING ---
    const GAS_URL = "https://script.google.com/macros/s/AKfycby5g-NkEqfboKfiRaxXXdkjkGuEBicYyzD1SbquU3echBes7136W9E-prb_yVItTE2N/exec"; // GANTI DENGAN URL ANDA!

    // --- State Aplikasi ---
    let state = {
        currentPlaylistId: null,
        currentSongIndex: 0,
        isPlaying: false,
        isLoop: false,
        isShuffle: false,
        songsData: {}, // { song_id: { likes: 10, dislikes: 2, comments: [] } }
        currentPlaylist: [],
        originalPlaylistOrder: []
    };

    // --- Elemen DOM ---
    const dom = {
        views: {
            playlist: document.getElementById('playlist-view'),
            player: document.getElementById('player-view')
        },
        audioPlayer: new Audio(),
        playlistGrid: document.querySelector('.b-player-playlist-grid'),
        backToPlaylistsBtn: document.getElementById('back-to-playlists-btn'),
        playerThumbnail: document.getElementById('player-thumbnail'),
        playerSongTitle: document.getElementById('player-song-title'),
        playerSongArtist: document.getElementById('player-song-artist'),
        playerSongGenre: document.getElementById('player-song-genre'),
        likeBtn: document.getElementById('like-btn'),
        likeCount: document.getElementById('like-count'),
        dislikeBtn: document.getElementById('dislike-btn'),
        dislikeCount: document.getElementById('dislike-count'),
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
    };

    // --- FUNGSI UTAMA ---

    async function init() {
        console.log("Memulai Pemutar Musik v2.0...");
        loadStateFromStorage();
        renderPlaylists();
        await fetchAllSongsData();
        
        const urlParams = new URLSearchParams(window.location.search);
        const songIdParam = urlParams.get('song');
        const playlistIdParam = urlParams.get('playlist');

        if (playlistIdParam) {
            const playlist = musicDatabase.playlists.find(p => p.id === playlistIdParam);
            if (playlist) {
                switchToPlayerView(playlist);
                if (songIdParam) {
                    const songIndex = playlist.songIds.indexOf(songIdParam);
                    if (songIndex > -1) {
                        loadSong(songIndex);
                    }
                }
            }
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

    // --- FUNGSI PERGANTIAN TAMPILAN ---

    function switchToPlaylistView() {
        dom.views.player.classList.remove('active');
        dom.views.playlist.classList.add('active');
        state.currentPlaylistId = null;
        saveStateToStorage();
    }

    function switchToPlayerView(playlist) {
        state.currentPlaylistId = playlist.id;
        state.currentPlaylist = playlist.songIds.map(id => musicDatabase.songs.find(s => s.id === id));
        state.originalPlaylistOrder = [...state.currentPlaylist];
        
        dom.views.playlist.classList.remove('active');
        dom.views.player.classList.add('active');
        
        renderSonglist();
        loadSong(state.currentSongIndex < state.currentPlaylist.length ? state.currentSongIndex : 0);
        saveStateToStorage();
    }

    // --- FUNGSI RENDER ---

    function renderPlaylists() {
        dom.playlistGrid.innerHTML = '';
        musicDatabase.playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'b-player-playlist-card';
            card.innerHTML = `
                <img src="${playlist.thumbnail}" alt="${playlist.name}" onerror="this.src='https://placehold.co/400x400/333/ccc?text=Error'">
                <h3>${playlist.name}</h3>
                <p>${playlist.description}</p>
            `;
            card.addEventListener('click', () => switchToPlayerView(playlist));
            dom.playlistGrid.appendChild(card);
        });
    }
    
    function renderSonglist() {
        dom.songlistContainer.innerHTML = '';
        state.currentPlaylist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'b-player-song-item';
            item.dataset.index = index;
            item.innerHTML = `
                <img src="${song.thumbnail}" alt="${song.title}" onerror="this.src='https://placehold.co/40x40/333/ccc?text=S'">
                <div class="b-player-song-item-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
            `;
            item.addEventListener('click', () => {
                if(state.isShuffle) {
                    // Jika shuffle, cari index asli dari lagu yg diklik
                    const originalIndex = state.originalPlaylistOrder.findIndex(s => s.id === song.id);
                    state.currentSongIndex = originalIndex;
                } else {
                    state.currentSongIndex = index;
                }
                loadSong(state.currentSongIndex);
            });
            dom.songlistContainer.appendChild(item);
        });
    }
    
    function updateSongDisplay(song) {
        dom.playerThumbnail.src = song.thumbnail;
        dom.playerSongTitle.textContent = song.title;
        dom.playerSongArtist.textContent = song.artist;
        dom.playerSongGenre.textContent = song.genre;
        dom.lyricsContainer.textContent = song.lyrics || "Lirik tidak tersedia untuk lagu ini.";

        document.querySelectorAll('.b-player-song-item').forEach(item => {
            const songId = state.currentPlaylist[item.dataset.index]?.id;
            item.classList.toggle('playing', songId === song.id);
        });
        
        updateInteractionDisplay(song.id);
        fetchComments(song.id);
    }

    function updateInteractionDisplay(songId) {
        const data = state.songsData[songId] || { likes: 0, dislikes: 0 };
        dom.likeCount.textContent = data.likes;
        dom.dislikeCount.textContent = data.dislikes;
    }

    function renderComments(comments) {
        dom.commentsContainer.innerHTML = '';
        dom.commentCount.textContent = comments.length;
        
        const commentMap = {};
        const rootComments = [];

        comments.forEach(comment => {
            commentMap[comment.comment_id] = { ...comment, replies: [] };
        });

        comments.forEach(comment => {
            if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
                commentMap[comment.parent_comment_id].replies.push(commentMap[comment.comment_id]);
            } else {
                rootComments.push(commentMap[comment.comment_id]);
            }
        });

        rootComments.forEach(comment => {
            dom.commentsContainer.appendChild(createCommentElement(comment));
            comment.replies.forEach(reply => {
                dom.commentsContainer.appendChild(createCommentElement(reply, true));
            });
        });
    }

    function createCommentElement(comment, isReply = false) {
        const div = document.createElement('div');
        div.className = `b-player-comment ${isReply ? 'is-reply' : ''}`;
        div.id = `comment-${comment.comment_id}`;
        
        const processedContent = comment.comment_content
            .replace(/</g, "&lt;").replace(/>/g, "&gt;") // Basic sanitization
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>');
            // TODO: Tambahkan parser untuk link, gambar, video, spoiler

        div.innerHTML = `
            <img class="b-player-comment-avatar" src="${comment.user_avatar || 'https://placehold.co/40x40/555/ccc?text=U'}" onerror="this.src='https://placehold.co/40x40/555/ccc?text=U'">
            <div class="b-player-comment-body">
                <div class="b-player-comment-header">
                    <span class="name">${comment.user_name}</span>
                    <span class="time">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <div class="b-player-comment-content">${processedContent}</div>
                <div class="b-player-comment-actions">
                    <span class="action-btn reply-btn" data-comment-id="${comment.comment_id}" data-user-name="${comment.user_name}">Balas</span>
                    <!-- Fitur like & report komentar bisa ditambahkan di sini -->
                </div>
            </div>
        `;
        return div;
    }

    // --- FUNGSI LOGIKA PEMUTAR ---
    
    let currentSourceIndex = 0;
    function loadSong(index) {
        if (index < 0 || index >= state.currentPlaylist.length) index = 0;
        const song = state.currentPlaylist[index];
        if (!song) {
            console.error("Lagu tidak ditemukan pada index:", index);
            return;
        }

        state.currentSongIndex = state.originalPlaylistOrder.findIndex(s => s.id === song.id);
        updateSongDisplay(song);
        
        currentSourceIndex = 0;
        tryLoadSource();
        saveStateToStorage();
    }

    function tryLoadSource() {
        const song = state.originalPlaylistOrder[state.currentSongIndex];
        if (currentSourceIndex < song.sources.length) {
            dom.audioPlayer.src = song.sources[currentSourceIndex];
            if (state.isPlaying) {
                dom.audioPlayer.play().catch(e => console.error("Gagal memutar otomatis:", e));
            }
        } else {
            console.error(`Semua sumber untuk lagu "${song.title}" gagal.`);
            if(state.isPlaying) setTimeout(nextSong, 1000);
        }
    }

    function playSong() {
        state.isPlaying = true;
        dom.audioPlayer.play();
        dom.playIcon.style.display = 'none';
        dom.pauseIcon.style.display = 'block';
    }

    function pauseSong() {
        state.isPlaying = false;
        dom.audioPlayer.pause();
        dom.playIcon.style.display = 'block';
        dom.pauseIcon.style.display = 'none';
    }
    
    function nextSong() {
        let nextIndex = (state.currentSongIndex + 1) % state.originalPlaylistOrder.length;
        loadSong(nextIndex);
    }

    function prevSong() {
        let prevIndex = (state.currentSongIndex - 1 + state.originalPlaylistOrder.length) % state.originalPlaylistOrder.length;
        loadSong(prevIndex);
    }
    
    function updateProgress() {
        const { duration, currentTime } = dom.audioPlayer;
        if (duration) {
            const progressPercent = (currentTime / duration) * 100;
            dom.progressBar.style.width = `${progressPercent}%`;
            dom.currentTime.textContent = formatTime(currentTime);
            dom.duration.textContent = formatTime(duration);
        }
    }
    
    function setProgress(e) {
        const width = this.clientWidth;
        const clickX = e.offsetX;
        dom.audioPlayer.currentTime = (clickX / width) * dom.audioPlayer.duration;
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        dom.shuffleBtn.classList.toggle('active', state.isShuffle);
        if(state.isShuffle) {
            // Acak playlist tapi jangan ubah lagu yg sedang diputar
            const currentSong = state.currentPlaylist[state.currentSongIndex];
            let shuffled = [...state.originalPlaylistOrder].sort(() => Math.random() - 0.5);
            // Pindahkan lagu saat ini ke posisi pertama
            shuffled = shuffled.filter(s => s.id !== currentSong.id);
            shuffled.unshift(currentSong);
            state.currentPlaylist = shuffled;
        } else {
            state.currentPlaylist = [...state.originalPlaylistOrder];
        }
        renderSonglist();
        updateSongDisplay(state.originalPlaylistOrder[state.currentSongIndex]);
        saveStateToStorage();
    }

    // --- FUNGSI INTERAKSI DENGAN API (GOOGLE APPS SCRIPT) ---
    
    async function fetchAllSongsData() {
        try {
            const response = await fetch(`${GAS_URL}?action=getSongsData`);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            data.forEach(song => {
                state.songsData[song.song_id] = { likes: song.likes || 0, dislikes: song.dislikes || 0 };
            });
            console.log("Data lagu (likes/dislikes) berhasil dimuat.");
        } catch (error) {
            console.error("Error fetching songs data:", error);
        }
    }

    async function fetchComments(songId) {
        try {
            const response = await fetch(`${GAS_URL}?action=getComments&song_id=${songId}`);
            if (!response.ok) throw new Error("Gagal mengambil komentar");
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            state.songsData[songId] = { ...state.songsData[songId], comments: data };
            renderComments(data);
        } catch (error) {
            console.error("Error fetching comments:", error);
        }
    }

    async function postInteraction(songId, type) {
        if (!state.songsData[songId]) {
            state.songsData[songId] = { likes: 0, dislikes: 0 };
        }
        state.songsData[songId][type === 'like' ? 'likes' : 'dislikes']++;
        updateInteractionDisplay(songId);

        try {
            await fetch(`${GAS_URL}?action=updateSongInteraction`, {
                method: 'POST',
                mode: 'no-cors', // Diperlukan untuk request sederhana ke GAS dari browser
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_id: songId, type: type })
            });
        } catch (error) {
            console.error("Error posting interaction:", error);
        }
    }

    async function postComment(e) {
        e.preventDefault();
        const submitBtn = dom.commentForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';

        const formData = new FormData(dom.commentForm);
        const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
        const commentData = {
            song_id: songId,
            user_name: formData.get('user_name'),
            user_avatar: formData.get('user_avatar'),
            user_website: formData.get('user_website'),
            user_email: formData.get('user_email'),
            comment_content: formData.get('comment_content'),
            parent_comment_id: formData.get('parent_comment_id')
        };
        
        try {
            await fetch(`${GAS_URL}?action=postComment`, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commentData)
            });
            dom.commentForm.reset();
            // Refresh komentar setelah beberapa saat
            setTimeout(() => fetchComments(songId), 2000);
        } catch(error) {
            console.error("Gagal mengirim komentar:", error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Komentar';
        }
    }

    // --- FUNGSI PENYIMPANAN LOKAL ---

    function saveStateToStorage() {
        const stateToSave = {
            currentPlaylistId: state.currentPlaylistId,
            currentSongIndex: state.currentSongIndex,
            isLoop: state.isLoop,
            isShuffle: state.isShuffle,
            volume: dom.audioPlayer.volume
        };
        localStorage.setItem('bPlayerState', JSON.stringify(stateToSave));
    }

    function loadStateFromStorage() {
        const savedState = localStorage.getItem('bPlayerState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            state.currentPlaylistId = parsedState.currentPlaylistId;
            state.currentSongIndex = parsedState.currentSongIndex || 0;
            state.isLoop = parsedState.isLoop || false;
            state.isShuffle = parsedState.isShuffle || false;
            dom.audioPlayer.volume = parsedState.volume || 1;
            
            dom.loopBtn.classList.toggle('active', state.isLoop);
            dom.audioPlayer.loop = state.isLoop;
            dom.shuffleBtn.classList.toggle('active', state.isShuffle);
        }
    }

    // --- FUNGSI HELPER ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Kontrol Player
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
        
        // Progress Bar
        dom.audioPlayer.addEventListener('timeupdate', updateProgress);
        dom.audioPlayer.addEventListener('loadedmetadata', updateProgress);
        dom.audioPlayer.addEventListener('ended', () => { if (!state.isLoop) nextSong(); });
        dom.audioPlayer.addEventListener('error', () => {
             console.warn(`Gagal memuat: ${dom.audioPlayer.currentSrc}`);
             currentSourceIndex++;
             tryLoadSource();
        });
        dom.progressContainer.addEventListener('click', setProgress);

        // Tombol kembali
        dom.backToPlaylistsBtn.addEventListener('click', switchToPlaylistView);
        
        // Tabs
        dom.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                dom.tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dom.tabContents.forEach(c => c.classList.remove('active'));
                document.getElementById(`${tab}-content`).classList.add('active');
            });
        });

        // Interaksi
        dom.likeBtn.addEventListener('click', () => {
            const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
            postInteraction(songId, 'like');
        });
        dom.dislikeBtn.addEventListener('click', () => {
            const songId = state.originalPlaylistOrder[state.currentSongIndex].id;
            postInteraction(songId, 'dislike');
        });

        // Form Komentar
        dom.commentForm.addEventListener('submit', postComment);
    }

    // --- Mulai Aplikasi ---
    init();
});
