// DATABASE LAGU DAN PLAYLIST
// Di sinilah Anda menambahkan semua lagu dan membuat playlist.

const musicDatabase = {
  // Master list semua lagu Anda
  songs: [
    {
      id: "song001",
      title: "Contoh Lagu Pop",
      artist: "Artis Populer",
      genre: "Pop",
      thumbnail: "https://placehold.co/400x400/1DB954/FFFFFF?text=Lagu+1",
      sources: [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Server 1
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", // Server 2 (Backup)
      ],
      lyrics: `Baris pertama lirik untuk lagu pop.\nBaris kedua yang catchy.\n\nMasuk ke bagian reffrain!\nOoh, ini lagu yang enak didengar.`,
    },
    {
      id: "song002",
      title: "Melodi Santai",
      artist: "Gitaris Akustik",
      genre: "Akustik",
      thumbnail: "https://placehold.co/400x400/E8115B/FFFFFF?text=Lagu+2",
      sources: [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      ],
      lyrics: `Lirik untuk melodi santai.\nSempurna untuk menemani senja.`,
    },
    {
      id: "song003",
      title: "Energi Rock",
      artist: "Band Rock",
      genre: "Rock",
      thumbnail: "https://placehold.co/400x400/F59B23/FFFFFF?text=Lagu+3",
      sources: [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      ],
      lyrics: `Lirik penuh semangat!\nYeah! Rock and roll!`,
    },
    {
      id: "song004",
      title: "Lagu Gagal",
      artist: "Error 404",
      genre: "Eksperimental",
      thumbnail: "https://placehold.co/400x400/D40000/FFFFFF?text=Error",
      sources: [
        "https://url-yang-pasti-gagal.com/lagu.mp3",
        "https://url-backup-juga-gagal.com/lagu.mp3",
      ],
      lyrics: `Lirik ini tidak akan pernah terdengar.`,
    },
  ],

  // Daftar playlist Anda
  playlists: [
    {
      id: "pl01",
      name: "Lagu Hits Saat Ini",
      description: "Kumpulan lagu yang sedang viral dan populer.",
      thumbnail: "https://placehold.co/400x400/2D46B9/FFFFFF?text=Hits",
      songIds: ["song001", "song003"], // Panggil ID lagu dari master list di atas
    },
    {
      id: "pl02",
      name: "Suasana Santai",
      description: "Musik akustik untuk menemani sore hari Anda.",
      thumbnail: "https://placehold.co/400x400/7D4B32/FFFFFF?text=Santai",
      songIds: ["song002"],
    },
    {
      id: "pl03",
      name: "Semua Lagu",
      description: "Mainkan semua lagu yang ada di koleksi ini.",
      thumbnail: "https://placehold.co/400x400/503750/FFFFFF?text=Semua",
      songIds: ["song001", "song002", "song003", "song004"],
    },
  ],
};
