/**
 * Aset gambar dari desain Stitch (`stitch_sistem_desain_lengkap_web/`).
 * Dipusatkan di sini agar mudah diganti bila URL eksternal kedaluwarsa.
 */
export const ASSETS = {
  avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpBC3uv-uYWiP9wWtaaem-hEtj-2nqT0f4SrzkXNqPPeqUDL7ls6wWmYAprBHQk_CGUxURkfCERLHNB7qlEhG5hhE6Sbt2tzFBwrRbTEQ4gc5NwWbPyNe_K3kdZoqmA0Ai-IpjgVoquUz8UtDKbg1nVhjhW5w19EkxRPkA6NhRNStN6ISXMIpYAoDE1GJN0Ityk1JS1dRsVHxOgdIIhm6YZIicQmk5O8GnGUkOOd6i4IJzQjC_fwEN",
  heroCourt: "https://lh3.googleusercontent.com/aida-public/AB6AXuC2prNC85mW-egqxQGqIl46Ci36Zp4FEIysTx9J_Bj6xtftlV0xyQ8ie7pNagS8Hcr9QqBaA4axYH7xh6xbypltg0GsCHzbHwX9t8EmSPM6-gQ4Qt4wJgSXbGSDwX4e-qq7j77gCv0-tQ3cnkzjdRZulZN9bEJA6p-RmAJxnRozdLRAwF-aMa7Y2fpL8R3q9AB1Oduvvln9q0xnRgQvB-Nu8xMkButLs9KJhrcjUYLKgq7zFSdPBL2H",
  courtPanoramico: "https://lh3.googleusercontent.com/aida-public/AB6AXuB5hfzASudEXtcEP2VryYqRg_vcJq45aDfRgVUhjsciK1XKvYeGG6Usff0PgdFov_bsbL9i1Gtc2LKITyOmeEv3dPhqA9FzkO0NGaAUqpaBxObirnZJOF0f0w_detvMKX528W84irxscwtRh4qOxsi90VrOHDGnSKjan_4lize9t4Hvx-P_Oh20-ZXlf-w6IbHi0irLssbkx5TsGfLciAAdZwb5QuGHI5LwubO8H8-R9wHkpVZsCqiJ",
  courtOutdoor: "https://lh3.googleusercontent.com/aida-public/AB6AXuAXoMfpCkjkqvaUuFG8YigS-7MvKnkupo_g5S1WzgUSHUR6Bn6sE8YOLPwE5e-OTDtBzbfyDUTP8AfXhss4bQgspSzV4QafynCqEJLJihg5md_m-WC3vuyYFnmO2gHDZGE6zV0TYLTGI8WCweKut-ii7SxtO0IscHQQlbVPPnV7lKio1H6mUg6jlVx8XtpayCoxBWE-PYMC5P5QD-ueEwa49--RCGlRgtGJV1w2LjTntf8bL4zM9tqy",
  courtIndoor: "https://lh3.googleusercontent.com/aida-public/AB6AXuCFjKHZGPQqgH9_jrkMOqusRkbwePx76olqk6ZAlekiSbR3eCEju3K79Se-v1Wl49T30k0xcf9bhJ5XVle9jj1Oi8uyMb7jepF076_Q_BnwylN5rsG9clrvhzMwX2aVS6FjRxBY4Ch-ydTpzfAUXZmldfbFknHkxS2Q_Y961rmuzNJEF8A1kPTzaoCUNzKUsRlAkxqp0PR8K_hsxk0KDE5OQsCryPl0xTcghaXEKiHIta76ycm7c6Wv",
  mapKemang: "https://lh3.googleusercontent.com/aida-public/AB6AXuBgxIWYtJAJZzjbVPNNw0KDWMgH1oqZxhfTbpEFdWOHeu8DwOOKby7RAirOf6w7usY394XzmtT4ZodopXg3fpVWp7qXirdWq9dNhyCvvFFwdOmpHpjpkgqUf7vbh-rplIMLuPFu41Pu1YAzF-QO6Xz0--9Hwz_GJ84mCNDaYej0LV1rDLqxBCH28EcBd9CzUPAN4uQbnLDoVpPfy12TE8cQqXZEmVhHq4l5rYAZ3N7I0VMNaIVLXjy5",
  mapTicket: "https://lh3.googleusercontent.com/aida-public/AB6AXuD8Swg4bzEFzZ9_SK04TsCKFBezSu8-8VWJZOtGgDe1kX96hVyHNt_RfumYzKDUMvjaCrSKgfqkQkuMUMLTjEXZ049GRaojkklMux6DatWLE0txsGfW3-p8EXCI2AsjfS3P_hXR79tSbi6CDLb1Q5lh17qetZRExGJsDx2sg4r-Snhwbu3NFmWfjOkzq9DdILXdWVvw55Pt6MnYChS7Q-S9ZgrPVCMY4OI7NZYp93sAQLmlKj9p6aoX",
} as const;

/**
 * Catatan: URL logo dari desain (path `/aida/`) membalas 403, jadi logo
 * dibangun sebagai mark SVG lokal (`Brand`) dan avatar admin memakai `avatar`.
 */

/** URL peta (Google Static-style) untuk kartu lokasi. */
export const MAP_URL = ASSETS.mapKemang;
