document.addEventListener("DOMContentLoaded", () => {
  // --- KONFIGURASI PENTING ---
  const GAS_URL =
    "https://script.google.com/macros/s/AKfycby5g-NkEqfboKfiRaxXXdkjkGuEBicYyzD1SbquU3echBes7136W9E-prb_yVItTE2N/exec"; // GANTI DENGAN URL WEB APP ANDA!

  // --- State Aplikasi ---
  let state = {
    currentPlaylistId: null,
    currentSongIndex: 0,
    isPlaying: false,
    isLoop: false,
    isShuffle: false,
    songsData: {}, // { song_id: { likes: 10, dislikes: 2 } }
    currentPlaylist: [],
  };

  // --- Elemen DOM ---
  const views = {
    playlist: document.getElementById("playlist-view"),
    player: document.getElementById("player-view"),
  };
  const audioPlayer = new Audio();
  // ... (banyak elemen DOM lain akan diambil sesuai kebutuhan)

  // --- FUNGSI UTAMA ---

  function init() {
    console.log("Memulai Pemutar Musik...");
    loadStateFromStorage();
    renderPlaylists();
    fetchSongsData(); // Ambil data like/dislike dari awal

    const urlParams = new URLSearchParams(window.location.search);
    const songIdParam = urlParams.get("song");
    // TODO: Tambahkan logika untuk deep link comment

    if (state.currentPlaylistId) {
      const playlist = musicDatabase.playlists.find(
        (p) => p.id === state.currentPlaylistId
      );
      if (playlist) {
        switchToPlayerView(playlist);
      } else {
        switchToPlaylistView();
      }
    } else {
      switchToPlaylistView();
    }

    setupEventListeners();
  }

  // --- FUNGSI PERGANTIAN TAMPILAN ---

  function switchToPlaylistView() {
    views.player.classList.remove("active");
    views.playlist.classList.add("active");
    state.currentPlaylistId = null;
    saveStateToStorage();
  }

  function switchToPlayerView(playlist) {
    state.currentPlaylistId = playlist.id;
    state.currentPlaylist = playlist.songIds.map((id) =>
      musicDatabase.songs.find((s) => s.id === id)
    );
    views.playlist.classList.remove("active");
    views.player.classList.add("active");
    renderPlayerUI(playlist);
    loadSong(state.currentSongIndex);
    saveStateToStorage();
  }

  // --- FUNGSI RENDER ---

  function renderPlaylists() {
    const grid = document.querySelector(".b-player-playlist-grid");
    grid.innerHTML = "";
    musicDatabase.playlists.forEach((playlist) => {
      const card = document.createElement("div");
      card.className = "b-player-playlist-card";
      card.innerHTML = `
                <img src="${playlist.thumbnail}" alt="${playlist.name}" onerror="this.src='https://placehold.co/400x400/333/ccc?text=Error'">
                <h3>${playlist.name}</h3>
                <p>${playlist.description}</p>
            `;
      card.addEventListener("click", () => switchToPlayerView(playlist));
      grid.appendChild(card);
    });
  }

  function renderPlayerUI(playlist) {
    // Render daftar lagu di tab "Playlist"
    const songlistContainer = document.getElementById("songlist-container");
    songlistContainer.innerHTML = "";
    state.currentPlaylist.forEach((song, index) => {
      const item = document.createElement("div");
      item.className = "b-player-song-item";
      item.dataset.index = index;
      item.innerHTML = `
                <img src="${song.thumbnail}" alt="${song.title}">
                <div class="b-player-song-item-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
            `;
      item.addEventListener("click", () => {
        state.currentSongIndex = index;
        loadSong(index);
      });
      songlistContainer.appendChild(item);
    });
  }

  function updateSongDisplay(song) {
    document.getElementById("player-thumbnail").src = song.thumbnail;
    document.getElementById("player-song-title").textContent = song.title;
    document.getElementById("player-song-artist").textContent = song.artist;
    document.getElementById("player-song-genre").textContent = song.genre;

    // Update highlight di daftar putar
    document.querySelectorAll(".b-player-song-item").forEach((item) => {
      item.classList.toggle(
        "playing",
        parseInt(item.dataset.index) === state.currentSongIndex
      );
    });

    // TODO: Render Komentar
    // TODO: Render Like/Dislike
  }

  // --- FUNGSI LOGIKA PEMUTAR ---

  let currentSourceIndex = 0;
  function loadSong(index) {
    const song = state.currentPlaylist[index];
    if (!song) return;

    state.currentSongIndex = index;
    updateSongDisplay(song);

    currentSourceIndex = 0;
    tryLoadSource();
    saveStateToStorage();
  }

  function tryLoadSource() {
    const song = state.currentPlaylist[state.currentSongIndex];
    if (currentSourceIndex < song.sources.length) {
      audioPlayer.src = song.sources[currentSourceIndex];
      if (state.isPlaying) {
        audioPlayer
          .play()
          .catch((e) => console.error("Gagal memutar otomatis:", e));
      }
    } else {
      console.error(`Semua sumber untuk lagu "${song.title}" gagal.`);
      // TODO: Tampilkan pesan error di UI
      if (state.isPlaying) nextSong(); // Coba lagu selanjutnya jika sedang auto-play
    }
  }

  function playSong() {
    state.isPlaying = true;
    audioPlayer.play();
    document.getElementById("play-icon").style.display = "none";
    document.getElementById("pause-icon").style.display = "block";
  }

  function pauseSong() {
    state.isPlaying = false;
    audioPlayer.pause();
    document.getElementById("play-icon").style.display = "block";
    document.getElementById("pause-icon").style.display = "none";
  }

  function nextSong() {
    if (state.isShuffle) {
      state.currentSongIndex = Math.floor(
        Math.random() * state.currentPlaylist.length
      );
    } else {
      state.currentSongIndex =
        (state.currentSongIndex + 1) % state.currentPlaylist.length;
    }
    loadSong(state.currentSongIndex);
  }

  function prevSong() {
    state.currentSongIndex =
      (state.currentSongIndex - 1 + state.currentPlaylist.length) %
      state.currentPlaylist.length;
    loadSong(state.currentSongIndex);
  }

  function updateProgress() {
    const { duration, currentTime } = audioPlayer;
    if (duration) {
      const progressPercent = (currentTime / duration) * 100;
      document.getElementById(
        "progress-bar"
      ).style.width = `${progressPercent}%`;
      document.getElementById("current-time").textContent =
        formatTime(currentTime);
      document.getElementById("duration").textContent = formatTime(duration);
    }
  }

  function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
  }

  // --- FUNGSI INTERAKSI DENGAN API (GOOGLE APPS SCRIPT) ---

  async function fetchSongsData() {
    try {
      const response = await fetch(`${GAS_URL}?action=getSongsData`);
      if (!response.ok) throw new Error("Gagal mengambil data lagu");
      const data = await response.json();
      data.forEach((song) => {
        state.songsData[song.song_id] = {
          likes: song.likes,
          dislikes: song.dislikes,
        };
      });
      console.log("Data lagu (likes/dislikes) berhasil dimuat.");
      // TODO: Update UI dengan data baru jika diperlukan
    } catch (error) {
      console.error("Error fetching songs data:", error);
    }
  }

  // --- FUNGSI PENYIMPANAN LOKAL ---

  function saveStateToStorage() {
    const stateToSave = {
      currentPlaylistId: state.currentPlaylistId,
      currentSongIndex: state.currentSongIndex,
      isLoop: state.isLoop,
      isShuffle: state.isShuffle,
      volume: audioPlayer.volume,
    };
    localStorage.setItem("bPlayerState", JSON.stringify(stateToSave));
  }

  function loadStateFromStorage() {
    const savedState = localStorage.getItem("bPlayerState");
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      state.currentPlaylistId = parsedState.currentPlaylistId;
      state.currentSongIndex = parsedState.currentSongIndex || 0;
      state.isLoop = parsedState.isLoop || false;
      state.isShuffle = parsedState.isShuffle || false;
      audioPlayer.volume = parsedState.volume || 1;

      // Update UI untuk loop/shuffle/volume
      document
        .getElementById("loop-btn")
        .classList.toggle("active", state.isLoop);
      audioPlayer.loop = state.isLoop;
      document
        .getElementById("shuffle-btn")
        .classList.toggle("active", state.isShuffle);
    }
  }

  // --- FUNGSI HELPER ---
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Kontrol Player
    document
      .getElementById("play-pause-btn")
      .addEventListener("click", () =>
        state.isPlaying ? pauseSong() : playSong()
      );
    document.getElementById("next-btn").addEventListener("click", nextSong);
    document.getElementById("prev-btn").addEventListener("click", prevSong);
    document.getElementById("loop-btn").addEventListener("click", () => {
      state.isLoop = !state.isLoop;
      audioPlayer.loop = state.isLoop;
      document
        .getElementById("loop-btn")
        .classList.toggle("active", state.isLoop);
      saveStateToStorage();
    });
    document.getElementById("shuffle-btn").addEventListener("click", () => {
      state.isShuffle = !state.isShuffle;
      document
        .getElementById("shuffle-btn")
        .classList.toggle("active", state.isShuffle);
      saveStateToStorage();
    });

    // Progress Bar
    audioPlayer.addEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("ended", () => {
      if (!state.isLoop) nextSong();
    });
    audioPlayer.addEventListener("error", () => {
      console.warn(`Gagal memuat: ${audioPlayer.currentSrc}`);
      currentSourceIndex++;
      tryLoadSource();
    });
    document
      .querySelector(".b-player-progress-container")
      .addEventListener("click", setProgress);

    // Tombol kembali ke playlist
    document
      .getElementById("back-to-playlists-btn")
      .addEventListener("click", switchToPlaylistView);

    // Tabs
    document.querySelectorAll(".b-player-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        document
          .querySelectorAll(".b-player-tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document
          .querySelectorAll(".b-player-tab-content")
          .forEach((c) => c.classList.remove("active"));
        document.getElementById(`${tab}-content`).classList.add("active");
      });
    });
  }

  // --- Mulai Aplikasi ---
  init();
});
