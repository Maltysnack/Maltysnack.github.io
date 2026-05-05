// coffeetime widget for Scriptable
// Shows a city currently in coffee time (6am to 8am local) with a photo,
// weather, and what locals would order. Refreshes ~every 15 min.
//
// To install: long-press the home screen, tap "+", choose Scriptable,
// pick the medium widget size, then tap the placeholder widget and set
// Script: "coffeetime". Tap the widget at any time to open the full page.

const PROXY        = "https://happyhour-proxy.vercel.app/api/image";
const SITE_URL     = "https://maltysnack.github.io/projects/coffeetime.html";
const HAPPY_START  = 6;
const HAPPY_END    = 8;
const REFRESH_MIN  = 15;
const ACCENT       = "#ffba6a"; // warm gold for the eyebrow pulse-dot

// ── DATA (auto-extracted from the website) ─────────────────────────
const CITIES = [
      // Asia / Pacific
      { name:"Tokyo", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:35.6762, lon:139.6503 },
      { name:"Kyoto", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:35.0116, lon:135.7681 },
      { name:"Osaka", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:34.6937, lon:135.5023 },
      { name:"Seoul", country:"South Korea", cc:"KR", tz:"Asia/Seoul", lat:37.5665, lon:126.9780 },
      { name:"Busan", country:"South Korea", cc:"KR", tz:"Asia/Seoul", lat:35.1796, lon:129.0756 },
      { name:"Beijing", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:39.9042, lon:116.4074 },
      { name:"Shanghai", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:31.2304, lon:121.4737 },
      { name:"Hong Kong", country:"Hong Kong", cc:"HK", tz:"Asia/Hong_Kong", lat:22.3193, lon:114.1694 },
      { name:"Taipei", country:"Taiwan", cc:"TW", tz:"Asia/Taipei", lat:25.0330, lon:121.5654 },
      { name:"Singapore", country:"Singapore", cc:"SG", tz:"Asia/Singapore", lat:1.3521, lon:103.8198 },
      { name:"Bangkok", country:"Thailand", cc:"TH", tz:"Asia/Bangkok", lat:13.7563, lon:100.5018 },
      { name:"Phuket", country:"Thailand", cc:"TH", tz:"Asia/Bangkok", lat:7.8804, lon:98.3923 },
      { name:"Chiang Mai", country:"Thailand", cc:"TH", tz:"Asia/Bangkok", lat:18.7883, lon:98.9853 },
      { name:"Hanoi", country:"Vietnam", cc:"VN", tz:"Asia/Ho_Chi_Minh", lat:21.0285, lon:105.8542 },
      { name:"Ho Chi Minh City", country:"Vietnam", cc:"VN", tz:"Asia/Ho_Chi_Minh", lat:10.8231, lon:106.6297 },
      { name:"Bali", country:"Indonesia", cc:"ID", tz:"Asia/Makassar", lat:-8.4095, lon:115.1889 },
      { name:"Jakarta", country:"Indonesia", cc:"ID", tz:"Asia/Jakarta", lat:-6.2088, lon:106.8456 },
      { name:"Manila", country:"Philippines", cc:"PH", tz:"Asia/Manila", lat:14.5995, lon:120.9842 },
      { name:"Cebu", country:"Philippines", cc:"PH", tz:"Asia/Manila", lat:10.3157, lon:123.8854 },
      { name:"Kuala Lumpur", country:"Malaysia", cc:"MY", tz:"Asia/Kuala_Lumpur", lat:3.1390, lon:101.6869 },
      { name:"Penang", country:"Malaysia", cc:"MY", tz:"Asia/Kuala_Lumpur", lat:5.4141, lon:100.3288 },
      { name:"Mumbai", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:19.0760, lon:72.8777 },
      { name:"New Delhi", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:28.6139, lon:77.2090 },
      { name:"Goa", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:15.2993, lon:74.1240 },
      { name:"Dubai", country:"United Arab Emirates", cc:"AE", tz:"Asia/Dubai", lat:25.2048, lon:55.2708 },
      { name:"Abu Dhabi", country:"United Arab Emirates", cc:"AE", tz:"Asia/Dubai", lat:24.4539, lon:54.3773 },
      // Europe / Africa / Middle East
      { name:"Istanbul", country:"Türkiye", cc:"TR", tz:"Europe/Istanbul", lat:41.0082, lon:28.9784 },
      { name:"Athens", country:"Greece", cc:"GR", tz:"Europe/Athens", lat:37.9838, lon:23.7275 },
      { name:"Mykonos", country:"Greece", cc:"GR", tz:"Europe/Athens", lat:37.4467, lon:25.3289 },
      { name:"Santorini", country:"Greece", cc:"GR", tz:"Europe/Athens", lat:36.3932, lon:25.4615 },
      { name:"Cairo", country:"Egypt", cc:"EG", tz:"Africa/Cairo", lat:30.0444, lon:31.2357 },
      { name:"Marrakech", country:"Morocco", cc:"MA", tz:"Africa/Casablanca", lat:31.6295, lon:-7.9811 },
      { name:"Casablanca", country:"Morocco", cc:"MA", tz:"Africa/Casablanca", lat:33.5731, lon:-7.5898 },
      { name:"Nairobi", country:"Kenya", cc:"KE", tz:"Africa/Nairobi", lat:-1.2921, lon:36.8219 },
      { name:"Mombasa", country:"Kenya", cc:"KE", tz:"Africa/Nairobi", lat:-4.0435, lon:39.6682 },
      { name:"Zanzibar", country:"Tanzania", cc:"TZ", tz:"Africa/Dar_es_Salaam", lat:-6.1659, lon:39.2026 },
      { name:"Cape Town", country:"South Africa", cc:"ZA", tz:"Africa/Johannesburg", lat:-33.9249, lon:18.4241 },
      { name:"Johannesburg", country:"South Africa", cc:"ZA", tz:"Africa/Johannesburg", lat:-26.2041, lon:28.0473 },
      { name:"Mauritius", country:"Mauritius", cc:"MU", tz:"Indian/Mauritius", lat:-20.3484, lon:57.5522 },
      { name:"Seychelles", country:"Seychelles", cc:"SC", tz:"Indian/Mahe", lat:-4.6796, lon:55.4920 },
      { name:"Madrid", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:40.4168, lon:-3.7038 },
      { name:"Barcelona", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:41.3851, lon:2.1734 },
      { name:"Seville", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:37.3891, lon:-5.9845 },
      { name:"Ibiza", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:38.9067, lon:1.4206 },
      { name:"Mallorca", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:39.6953, lon:3.0176 },
      { name:"Lisbon", country:"Portugal", cc:"PT", tz:"Europe/Lisbon", lat:38.7223, lon:-9.1393 },
      { name:"Porto", country:"Portugal", cc:"PT", tz:"Europe/Lisbon", lat:41.1579, lon:-8.6291 },
      { name:"Madeira", country:"Portugal", cc:"PT", tz:"Atlantic/Madeira", lat:32.7607, lon:-16.9595 },
      { name:"Paris", country:"France", cc:"FR", tz:"Europe/Paris", lat:48.8566, lon:2.3522 },
      { name:"Nice", country:"France", cc:"FR", tz:"Europe/Paris", lat:43.7102, lon:7.2620 },
      { name:"Marseille", country:"France", cc:"FR", tz:"Europe/Paris", lat:43.2965, lon:5.3698 },
      { name:"Rome", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:41.9028, lon:12.4964 },
      { name:"Milan", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:45.4642, lon:9.1900 },
      { name:"Florence", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:43.7696, lon:11.2558 },
      { name:"Venice", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:45.4408, lon:12.3155 },
      { name:"Naples", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:40.8518, lon:14.2681 },
      { name:"Amalfi", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:40.6340, lon:14.6027 },
      { name:"Berlin", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:52.5200, lon:13.4050 },
      { name:"Munich", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:48.1351, lon:11.5820 },
      { name:"Hamburg", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:53.5511, lon:9.9937 },
      { name:"Amsterdam", country:"Netherlands", cc:"NL", tz:"Europe/Amsterdam", lat:52.3676, lon:4.9041 },
      { name:"Brussels", country:"Belgium", cc:"BE", tz:"Europe/Brussels", lat:50.8503, lon:4.3517 },
      { name:"Vienna", country:"Austria", cc:"AT", tz:"Europe/Vienna", lat:48.2082, lon:16.3738 },
      { name:"Zurich", country:"Switzerland", cc:"CH", tz:"Europe/Zurich", lat:47.3769, lon:8.5417 },
      { name:"Geneva", country:"Switzerland", cc:"CH", tz:"Europe/Zurich", lat:46.2044, lon:6.1432 },
      { name:"Prague", country:"Czechia", cc:"CZ", tz:"Europe/Prague", lat:50.0755, lon:14.4378 },
      { name:"Budapest", country:"Hungary", cc:"HU", tz:"Europe/Budapest", lat:47.4979, lon:19.0402 },
      { name:"Warsaw", country:"Poland", cc:"PL", tz:"Europe/Warsaw", lat:52.2297, lon:21.0122 },
      { name:"Kraków", country:"Poland", cc:"PL", tz:"Europe/Warsaw", lat:50.0647, lon:19.9450 },
      { name:"Stockholm", country:"Sweden", cc:"SE", tz:"Europe/Stockholm", lat:59.3293, lon:18.0686 },
      { name:"Oslo", country:"Norway", cc:"NO", tz:"Europe/Oslo", lat:59.9139, lon:10.7522 },
      { name:"Copenhagen", country:"Denmark", cc:"DK", tz:"Europe/Copenhagen", lat:55.6761, lon:12.5683 },
      { name:"Helsinki", country:"Finland", cc:"FI", tz:"Europe/Helsinki", lat:60.1699, lon:24.9384 },
      { name:"Reykjavik", country:"Iceland", cc:"IS", tz:"Atlantic/Reykjavik", lat:64.1466, lon:-21.9426 },
      { name:"Dublin", country:"Ireland", cc:"IE", tz:"Europe/Dublin", lat:53.3498, lon:-6.2603 },
      { name:"London", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:51.5074, lon:-0.1278 },
      { name:"Edinburgh", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:55.9533, lon:-3.1883 },
      { name:"Dubrovnik", country:"Croatia", cc:"HR", tz:"Europe/Zagreb", lat:42.6507, lon:18.0944 },
      { name:"Split", country:"Croatia", cc:"HR", tz:"Europe/Zagreb", lat:43.5081, lon:16.4402 },
      { name:"Cape Verde", country:"Cape Verde", cc:"CV", tz:"Atlantic/Cape_Verde", lat:14.9330, lon:-23.5133 },
      // Americas
      { name:"New York", country:"United States", cc:"US", tz:"America/New_York", lat:40.7128, lon:-74.0060 },
      { name:"Miami", country:"United States", cc:"US", tz:"America/New_York", lat:25.7617, lon:-80.1918 },
      { name:"Chicago", country:"United States", cc:"US", tz:"America/Chicago", lat:41.8781, lon:-87.6298 },
      { name:"New Orleans", country:"United States", cc:"US", tz:"America/Chicago", lat:29.9511, lon:-90.0715 },
      { name:"Austin", country:"United States", cc:"US", tz:"America/Chicago", lat:30.2672, lon:-97.7431 },
      { name:"Las Vegas", country:"United States", cc:"US", tz:"America/Los_Angeles", lat:36.1699, lon:-115.1398 },
      { name:"Los Angeles", country:"United States", cc:"US", tz:"America/Los_Angeles", lat:34.0522, lon:-118.2437 },
      { name:"San Francisco", country:"United States", cc:"US", tz:"America/Los_Angeles", lat:37.7749, lon:-122.4194 },
      { name:"Seattle", country:"United States", cc:"US", tz:"America/Los_Angeles", lat:47.6062, lon:-122.3321 },
      { name:"Honolulu", country:"United States", cc:"US", tz:"Pacific/Honolulu", lat:21.3099, lon:-157.8581 },
      { name:"Toronto", country:"Canada", cc:"CA", tz:"America/Toronto", lat:43.6532, lon:-79.3832 },
      { name:"Montreal", country:"Canada", cc:"CA", tz:"America/Toronto", lat:45.5017, lon:-73.5673 },
      { name:"Vancouver", country:"Canada", cc:"CA", tz:"America/Vancouver", lat:49.2827, lon:-123.1207 },
      { name:"Mexico City", country:"Mexico", cc:"MX", tz:"America/Mexico_City", lat:19.4326, lon:-99.1332 },
      { name:"Tulum", country:"Mexico", cc:"MX", tz:"America/Cancun", lat:20.2114, lon:-87.4654 },
      { name:"Cancún", country:"Mexico", cc:"MX", tz:"America/Cancun", lat:21.1619, lon:-86.8515 },
      { name:"Oaxaca", country:"Mexico", cc:"MX", tz:"America/Mexico_City", lat:17.0732, lon:-96.7266 },
      { name:"Havana", country:"Cuba", cc:"CU", tz:"America/Havana", lat:23.1136, lon:-82.3666 },
      { name:"San Juan", country:"Puerto Rico", cc:"PR", tz:"America/Puerto_Rico", lat:18.4655, lon:-66.1057 },
      { name:"Kingston", country:"Jamaica", cc:"JM", tz:"America/Jamaica", lat:17.9712, lon:-76.7928 },
      { name:"Nassau", country:"Bahamas", cc:"BS", tz:"America/Nassau", lat:25.0480, lon:-77.3554 },
      { name:"Bridgetown", country:"Barbados", cc:"BB", tz:"America/Barbados", lat:13.1132, lon:-59.5988 },
      { name:"Panama City", country:"Panama", cc:"PA", tz:"America/Panama", lat:8.9824, lon:-79.5199 },
      { name:"San José", country:"Costa Rica", cc:"CR", tz:"America/Costa_Rica", lat:9.9281, lon:-84.0907 },
      { name:"Cartagena", country:"Colombia", cc:"CO", tz:"America/Bogota", lat:10.3910, lon:-75.4794 },
      { name:"Bogotá", country:"Colombia", cc:"CO", tz:"America/Bogota", lat:4.7110, lon:-74.0721 },
      { name:"Medellín", country:"Colombia", cc:"CO", tz:"America/Bogota", lat:6.2476, lon:-75.5658 },
      { name:"Lima", country:"Peru", cc:"PE", tz:"America/Lima", lat:-12.0464, lon:-77.0428 },
      { name:"Cusco", country:"Peru", cc:"PE", tz:"America/Lima", lat:-13.5319, lon:-71.9675 },
      { name:"Santiago", country:"Chile", cc:"CL", tz:"America/Santiago", lat:-33.4489, lon:-70.6693 },
      { name:"Buenos Aires", country:"Argentina", cc:"AR", tz:"America/Argentina/Buenos_Aires", lat:-34.6037, lon:-58.3816 },
      { name:"Mendoza", country:"Argentina", cc:"AR", tz:"America/Argentina/Buenos_Aires", lat:-32.8895, lon:-68.8458 },
      { name:"Montevideo", country:"Uruguay", cc:"UY", tz:"America/Montevideo", lat:-34.9011, lon:-56.1645 },
      { name:"Rio de Janeiro", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-22.9068, lon:-43.1729 },
      { name:"São Paulo", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-23.5505, lon:-46.6333 },
      { name:"Salvador", country:"Brazil", cc:"BR", tz:"America/Bahia", lat:-12.9714, lon:-38.5014 },
      { name:"Florianópolis", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-27.5954, lon:-48.5480 },
      // Oceania
      { name:"Sydney", country:"Australia", cc:"AU", tz:"Australia/Sydney", lat:-33.8688, lon:151.2093 },
      { name:"Melbourne", country:"Australia", cc:"AU", tz:"Australia/Melbourne", lat:-37.8136, lon:144.9631 },
      { name:"Brisbane", country:"Australia", cc:"AU", tz:"Australia/Brisbane", lat:-27.4698, lon:153.0251 },
      { name:"Perth", country:"Australia", cc:"AU", tz:"Australia/Perth", lat:-31.9505, lon:115.8605 },
      { name:"Auckland", country:"New Zealand", cc:"NZ", tz:"Pacific/Auckland", lat:-36.8485, lon:174.7633 },
      { name:"Queenstown", country:"New Zealand", cc:"NZ", tz:"Pacific/Auckland", lat:-45.0312, lon:168.6626 },
      { name:"Wellington", country:"New Zealand", cc:"NZ", tz:"Pacific/Auckland", lat:-41.2865, lon:174.7762 },
      // ── Added in variation pass (no beer data \u2014 strip will skip "cold one" item) ──
      // United States
      { name:"Boston", country:"United States", cc:"US", tz:"America/New_York", lat:42.3601, lon:-71.0589 },
      { name:"Philadelphia", country:"United States", cc:"US", tz:"America/New_York", lat:39.9526, lon:-75.1652 },
      { name:"Washington", country:"United States", cc:"US", tz:"America/New_York", lat:38.9072, lon:-77.0369 },
      { name:"Atlanta", country:"United States", cc:"US", tz:"America/New_York", lat:33.7490, lon:-84.3880 },
      { name:"Nashville", country:"United States", cc:"US", tz:"America/Chicago", lat:36.1627, lon:-86.7816 },
      { name:"Portland", country:"United States", cc:"US", tz:"America/Los_Angeles", lat:45.5152, lon:-122.6784 },
      { name:"Phoenix", country:"United States", cc:"US", tz:"America/Phoenix", lat:33.4484, lon:-112.0740 },
      { name:"Denver", country:"United States", cc:"US", tz:"America/Denver", lat:39.7392, lon:-104.9903 },
      { name:"Minneapolis", country:"United States", cc:"US", tz:"America/Chicago", lat:44.9778, lon:-93.2650 },
      { name:"Charleston", country:"United States", cc:"US", tz:"America/New_York", lat:32.7765, lon:-79.9311 },
      { name:"Savannah", country:"United States", cc:"US", tz:"America/New_York", lat:32.0809, lon:-81.0912 },
      // Canada
      { name:"Calgary", country:"Canada", cc:"CA", tz:"America/Edmonton", lat:51.0447, lon:-114.0719 },
      { name:"Edmonton", country:"Canada", cc:"CA", tz:"America/Edmonton", lat:53.5461, lon:-113.4938 },
      { name:"Quebec City", country:"Canada", cc:"CA", tz:"America/Toronto", lat:46.8139, lon:-71.2080 },
      { name:"Halifax", country:"Canada", cc:"CA", tz:"America/Halifax", lat:44.6488, lon:-63.5752 },
      // Latin America
      { name:"Guadalajara", country:"Mexico", cc:"MX", tz:"America/Mexico_City", lat:20.6597, lon:-103.3496 },
      { name:"Monterrey", country:"Mexico", cc:"MX", tz:"America/Monterrey", lat:25.6866, lon:-100.3161 },
      { name:"Puebla", country:"Mexico", cc:"MX", tz:"America/Mexico_City", lat:19.0414, lon:-98.2063 },
      { name:"Mérida", country:"Mexico", cc:"MX", tz:"America/Merida", lat:20.9674, lon:-89.5926 },
      { name:"Antigua", country:"Guatemala", cc:"GT", tz:"America/Guatemala", lat:14.5586, lon:-90.7295 },
      { name:"San Salvador", country:"El Salvador", cc:"SV", tz:"America/El_Salvador", lat:13.6929, lon:-89.2182 },
      { name:"Managua", country:"Nicaragua", cc:"NI", tz:"America/Managua", lat:12.1140, lon:-86.2362 },
      { name:"Tegucigalpa", country:"Honduras", cc:"HN", tz:"America/Tegucigalpa", lat:14.0723, lon:-87.1921 },
      { name:"Belize City", country:"Belize", cc:"BZ", tz:"America/Belize", lat:17.5046, lon:-88.1962 },
      { name:"Quito", country:"Ecuador", cc:"EC", tz:"America/Guayaquil", lat:-0.1807, lon:-78.4678 },
      { name:"Guayaquil", country:"Ecuador", cc:"EC", tz:"America/Guayaquil", lat:-2.1709, lon:-79.9224 },
      { name:"La Paz", country:"Bolivia", cc:"BO", tz:"America/La_Paz", lat:-16.4897, lon:-68.1193 },
      { name:"Sucre", country:"Bolivia", cc:"BO", tz:"America/La_Paz", lat:-19.0196, lon:-65.2619 },
      { name:"Asunción", country:"Paraguay", cc:"PY", tz:"America/Asuncion", lat:-25.2637, lon:-57.5759 },
      { name:"Curitiba", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-25.4284, lon:-49.2733 },
      { name:"Belo Horizonte", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-19.9167, lon:-43.9345 },
      { name:"Recife", country:"Brazil", cc:"BR", tz:"America/Recife", lat:-8.0476, lon:-34.8770 },
      { name:"Fortaleza", country:"Brazil", cc:"BR", tz:"America/Fortaleza", lat:-3.7172, lon:-38.5433 },
      { name:"Manaus", country:"Brazil", cc:"BR", tz:"America/Manaus", lat:-3.1190, lon:-60.0217 },
      { name:"Brasília", country:"Brazil", cc:"BR", tz:"America/Sao_Paulo", lat:-15.8267, lon:-47.9218 },
      { name:"Punta del Este", country:"Uruguay", cc:"UY", tz:"America/Montevideo", lat:-34.9667, lon:-54.9500 },
      // Caribbean
      { name:"Oranjestad", country:"Aruba", cc:"AW", tz:"America/Aruba", lat:12.5246, lon:-70.0274 },
      { name:"Willemstad", country:"Curaçao", cc:"CW", tz:"America/Curacao", lat:12.1696, lon:-68.9900 },
      { name:"Port of Spain", country:"Trinidad and Tobago", cc:"TT", tz:"America/Port_of_Spain", lat:10.6549, lon:-61.5019 },
      { name:"Castries", country:"Saint Lucia", cc:"LC", tz:"America/St_Lucia", lat:14.0101, lon:-60.9874 },
      // Europe \u2014 France
      { name:"Lyon", country:"France", cc:"FR", tz:"Europe/Paris", lat:45.7640, lon:4.8357 },
      { name:"Bordeaux", country:"France", cc:"FR", tz:"Europe/Paris", lat:44.8378, lon:-0.5792 },
      { name:"Toulouse", country:"France", cc:"FR", tz:"Europe/Paris", lat:43.6047, lon:1.4442 },
      { name:"Nantes", country:"France", cc:"FR", tz:"Europe/Paris", lat:47.2184, lon:-1.5536 },
      { name:"Strasbourg", country:"France", cc:"FR", tz:"Europe/Paris", lat:48.5734, lon:7.7521 },
      // Italy
      { name:"Bologna", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:44.4949, lon:11.3426 },
      { name:"Verona", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:45.4384, lon:10.9916 },
      { name:"Genoa", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:44.4056, lon:8.9463 },
      { name:"Pisa", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:43.7228, lon:10.4017 },
      { name:"Palermo", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:38.1157, lon:13.3615 },
      { name:"Cagliari", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:39.2238, lon:9.1217 },
      { name:"Bari", country:"Italy", cc:"IT", tz:"Europe/Rome", lat:41.1171, lon:16.8719 },
      // Spain
      { name:"Bilbao", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:43.2630, lon:-2.9350 },
      { name:"Valencia", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:39.4699, lon:-0.3763 },
      { name:"Granada", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:37.1773, lon:-3.5986 },
      { name:"San Sebastián", country:"Spain", cc:"ES", tz:"Europe/Madrid", lat:43.3183, lon:-1.9812 },
      // Germany
      { name:"Cologne", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:50.9375, lon:6.9603 },
      { name:"Frankfurt", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:50.1109, lon:8.6821 },
      { name:"Stuttgart", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:48.7758, lon:9.1829 },
      { name:"Düsseldorf", country:"Germany", cc:"DE", tz:"Europe/Berlin", lat:51.2277, lon:6.7735 },
      // UK & Ireland
      { name:"Manchester", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:53.4808, lon:-2.2426 },
      { name:"Liverpool", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:53.4084, lon:-2.9916 },
      { name:"Brighton", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:50.8225, lon:-0.1372 },
      { name:"Bath", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:51.3811, lon:-2.3590 },
      { name:"Glasgow", country:"United Kingdom", cc:"GB", tz:"Europe/London", lat:55.8642, lon:-4.2518 },
      { name:"Galway", country:"Ireland", cc:"IE", tz:"Europe/Dublin", lat:53.2707, lon:-9.0568 },
      { name:"Cork", country:"Ireland", cc:"IE", tz:"Europe/Dublin", lat:51.8985, lon:-8.4756 },
      // Low Countries
      { name:"Antwerp", country:"Belgium", cc:"BE", tz:"Europe/Brussels", lat:51.2194, lon:4.4025 },
      { name:"Ghent", country:"Belgium", cc:"BE", tz:"Europe/Brussels", lat:51.0543, lon:3.7174 },
      { name:"Rotterdam", country:"Netherlands", cc:"NL", tz:"Europe/Amsterdam", lat:51.9244, lon:4.4777 },
      { name:"Utrecht", country:"Netherlands", cc:"NL", tz:"Europe/Amsterdam", lat:52.0907, lon:5.1214 },
      // Alps
      { name:"Salzburg", country:"Austria", cc:"AT", tz:"Europe/Vienna", lat:47.8095, lon:13.0550 },
      { name:"Innsbruck", country:"Austria", cc:"AT", tz:"Europe/Vienna", lat:47.2692, lon:11.4041 },
      // Nordics
      { name:"Bergen", country:"Norway", cc:"NO", tz:"Europe/Oslo", lat:60.3913, lon:5.3221 },
      { name:"Trondheim", country:"Norway", cc:"NO", tz:"Europe/Oslo", lat:63.4305, lon:10.3951 },
      { name:"Stavanger", country:"Norway", cc:"NO", tz:"Europe/Oslo", lat:58.9700, lon:5.7331 },
      { name:"Gothenburg", country:"Sweden", cc:"SE", tz:"Europe/Stockholm", lat:57.7089, lon:11.9746 },
      { name:"Malmö", country:"Sweden", cc:"SE", tz:"Europe/Stockholm", lat:55.6050, lon:13.0038 },
      { name:"Aarhus", country:"Denmark", cc:"DK", tz:"Europe/Copenhagen", lat:56.1629, lon:10.2039 },
      { name:"Tampere", country:"Finland", cc:"FI", tz:"Europe/Helsinki", lat:61.4978, lon:23.7610 },
      // Eastern Europe
      { name:"Bratislava", country:"Slovakia", cc:"SK", tz:"Europe/Bratislava", lat:48.1486, lon:17.1077 },
      { name:"Ljubljana", country:"Slovenia", cc:"SI", tz:"Europe/Ljubljana", lat:46.0569, lon:14.5058 },
      { name:"Belgrade", country:"Serbia", cc:"RS", tz:"Europe/Belgrade", lat:44.7866, lon:20.4489 },
      { name:"Sofia", country:"Bulgaria", cc:"BG", tz:"Europe/Sofia", lat:42.6977, lon:23.3219 },
      { name:"Bucharest", country:"Romania", cc:"RO", tz:"Europe/Bucharest", lat:44.4268, lon:26.1025 },
      { name:"Vilnius", country:"Lithuania", cc:"LT", tz:"Europe/Vilnius", lat:54.6872, lon:25.2797 },
      { name:"Riga", country:"Latvia", cc:"LV", tz:"Europe/Riga", lat:56.9496, lon:24.1052 },
      { name:"Tallinn", country:"Estonia", cc:"EE", tz:"Europe/Tallinn", lat:59.4370, lon:24.7536 },
      { name:"Wrocław", country:"Poland", cc:"PL", tz:"Europe/Warsaw", lat:51.1079, lon:17.0385 },
      { name:"Gdańsk", country:"Poland", cc:"PL", tz:"Europe/Warsaw", lat:54.3520, lon:18.6466 },
      { name:"Brno", country:"Czechia", cc:"CZ", tz:"Europe/Prague", lat:49.1951, lon:16.6068 },
      // Asia \u2014 India
      { name:"Bangalore", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:12.9716, lon:77.5946 },
      { name:"Chennai", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:13.0827, lon:80.2707 },
      { name:"Hyderabad", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:17.3850, lon:78.4867 },
      { name:"Kolkata", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:22.5726, lon:88.3639 },
      { name:"Pune", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:18.5204, lon:73.8567 },
      { name:"Jaipur", country:"India", cc:"IN", tz:"Asia/Kolkata", lat:26.9124, lon:75.7873 },
      // Japan
      { name:"Sapporo", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:43.0618, lon:141.3545 },
      { name:"Fukuoka", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:33.5904, lon:130.4017 },
      { name:"Hiroshima", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:34.3853, lon:132.4553 },
      { name:"Yokohama", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:35.4437, lon:139.6380 },
      { name:"Nagoya", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:35.1815, lon:136.9066 },
      { name:"Kobe", country:"Japan", cc:"JP", tz:"Asia/Tokyo", lat:34.6901, lon:135.1956 },
      // SE Asia
      { name:"Da Nang", country:"Vietnam", cc:"VN", tz:"Asia/Ho_Chi_Minh", lat:16.0544, lon:108.2022 },
      { name:"Hue", country:"Vietnam", cc:"VN", tz:"Asia/Ho_Chi_Minh", lat:16.4637, lon:107.5909 },
      { name:"Nha Trang", country:"Vietnam", cc:"VN", tz:"Asia/Ho_Chi_Minh", lat:12.2388, lon:109.1967 },
      { name:"Phnom Penh", country:"Cambodia", cc:"KH", tz:"Asia/Phnom_Penh", lat:11.5564, lon:104.9282 },
      { name:"Siem Reap", country:"Cambodia", cc:"KH", tz:"Asia/Phnom_Penh", lat:13.3633, lon:103.8564 },
      { name:"Yogyakarta", country:"Indonesia", cc:"ID", tz:"Asia/Jakarta", lat:-7.7956, lon:110.3695 },
      { name:"Surabaya", country:"Indonesia", cc:"ID", tz:"Asia/Jakarta", lat:-7.2575, lon:112.7521 },
      // South Asia
      { name:"Lahore", country:"Pakistan", cc:"PK", tz:"Asia/Karachi", lat:31.5497, lon:74.3436 },
      { name:"Islamabad", country:"Pakistan", cc:"PK", tz:"Asia/Karachi", lat:33.6844, lon:73.0479 },
      { name:"Dhaka", country:"Bangladesh", cc:"BD", tz:"Asia/Dhaka", lat:23.8103, lon:90.4125 },
      { name:"Colombo", country:"Sri Lanka", cc:"LK", tz:"Asia/Colombo", lat:6.9271, lon:79.8612 },
      { name:"Kathmandu", country:"Nepal", cc:"NP", tz:"Asia/Kathmandu", lat:27.7172, lon:85.3240 },
      // China
      { name:"Shenzhen", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:22.5431, lon:114.0579 },
      { name:"Chengdu", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:30.5728, lon:104.0668 },
      { name:"Guangzhou", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:23.1291, lon:113.2644 },
      { name:"Xi'an", country:"China", cc:"CN", tz:"Asia/Shanghai", lat:34.3416, lon:108.9398 },
      { name:"Macau", country:"Macau", cc:"MO", tz:"Asia/Macau", lat:22.1987, lon:113.5439 },
      // Central Asia
      { name:"Almaty", country:"Kazakhstan", cc:"KZ", tz:"Asia/Almaty", lat:43.2220, lon:76.8512 },
      { name:"Tashkent", country:"Uzbekistan", cc:"UZ", tz:"Asia/Tashkent", lat:41.2995, lon:69.2401 },
      // Africa
      { name:"Kigali", country:"Rwanda", cc:"RW", tz:"Africa/Kigali", lat:-1.9706, lon:30.1044 },
      { name:"Kampala", country:"Uganda", cc:"UG", tz:"Africa/Kampala", lat:0.3476, lon:32.5825 },
      { name:"Addis Ababa", country:"Ethiopia", cc:"ET", tz:"Africa/Addis_Ababa", lat:9.0320, lon:38.7469 },
      { name:"Lusaka", country:"Zambia", cc:"ZM", tz:"Africa/Lusaka", lat:-15.3875, lon:28.3228 },
      { name:"Harare", country:"Zimbabwe", cc:"ZW", tz:"Africa/Harare", lat:-17.8252, lon:31.0335 },
      { name:"Maputo", country:"Mozambique", cc:"MZ", tz:"Africa/Maputo", lat:-25.9692, lon:32.5732 },
      { name:"Antananarivo", country:"Madagascar", cc:"MG", tz:"Indian/Antananarivo", lat:-18.8792, lon:47.5079 },
      { name:"Windhoek", country:"Namibia", cc:"NA", tz:"Africa/Windhoek", lat:-22.5609, lon:17.0658 },
      { name:"Gaborone", country:"Botswana", cc:"BW", tz:"Africa/Gaborone", lat:-24.6282, lon:25.9231 },
      { name:"Abidjan", country:"Côte d'Ivoire", cc:"CI", tz:"Africa/Abidjan", lat:5.3600, lon:-4.0083 },
      { name:"Dakar", country:"Senegal", cc:"SN", tz:"Africa/Dakar", lat:14.7167, lon:-17.4677 },
      { name:"Tunis", country:"Tunisia", cc:"TN", tz:"Africa/Tunis", lat:36.8065, lon:10.1815 },
      { name:"Algiers", country:"Algeria", cc:"DZ", tz:"Africa/Algiers", lat:36.7538, lon:3.0588 },
      { name:"Aswan", country:"Egypt", cc:"EG", tz:"Africa/Cairo", lat:24.0889, lon:32.8998 },
      // Oceania
      { name:"Hobart", country:"Australia", cc:"AU", tz:"Australia/Hobart", lat:-42.8821, lon:147.3272 },
      { name:"Adelaide", country:"Australia", cc:"AU", tz:"Australia/Adelaide", lat:-34.9285, lon:138.6007 },
      { name:"Cairns", country:"Australia", cc:"AU", tz:"Australia/Brisbane", lat:-16.9186, lon:145.7781 },
      { name:"Darwin", country:"Australia", cc:"AU", tz:"Australia/Darwin", lat:-12.4634, lon:130.8456 },
      { name:"Christchurch", country:"New Zealand", cc:"NZ", tz:"Pacific/Auckland", lat:-43.5321, lon:172.6362 },
      { name:"Apia", country:"Samoa", cc:"WS", tz:"Pacific/Apia", lat:-13.8506, lon:-171.7513 },
      { name:"Nukuʻalofa", country:"Tonga", cc:"TO", tz:"Pacific/Tongatapu", lat:-21.1394, lon:-175.2049 },
      { name:"Port Vila", country:"Vanuatu", cc:"VU", tz:"Pacific/Efate", lat:-17.7333, lon:168.3273 },
      { name:"Suva", country:"Fiji", cc:"FJ", tz:"Pacific/Fiji", lat:-18.1248, lon:178.4501 },
      { name:"Honiara", country:"Solomon Islands", cc:"SB", tz:"Pacific/Guadalcanal", lat:-9.4280, lon:159.9729 },
      { name:"Nouméa", country:"New Caledonia", cc:"NC", tz:"Pacific/Noumea", lat:-22.2758, lon:166.4581 },
      { name:"Papeete", country:"French Polynesia", cc:"PF", tz:"Pacific/Tahiti", lat:-17.5516, lon:-149.5585 },
      { name:"Pago Pago", country:"American Samoa", cc:"AS", tz:"Pacific/Pago_Pago", lat:-14.2756, lon:-170.7020 },
      { name:"Anchorage", country:"United States", cc:"US", tz:"America/Anchorage", lat:61.2181, lon:-149.9003 },
      { name:"Tarawa", country:"Kiribati", cc:"KI", tz:"Pacific/Tarawa", lat:1.3290, lon:172.9790 },
    ];;

const COFFEES = {
      // ── Asia / Pacific ─────────────────────────────────
      "Tokyo-JP":            ["Pour-over", "Tamago Sando"],
      "Kyoto-JP":            ["Drip Coffee", "Wagashi"],
      "Osaka-JP":            ["Drip Coffee", "Anpan"],
      "Sapporo-JP":          ["Drip Coffee", "Castella"],
      "Fukuoka-JP":          ["Drip Coffee", "Mentaiko Toast"],
      "Yokohama-JP":         ["Drip Coffee", "Anpan"],
      "Hiroshima-JP":        ["Drip Coffee", "Momiji Manju"],
      "Nagoya-JP":           ["Coffee", "Ogura Toast"],
      "Kobe-JP":             ["Drip Coffee", "Pudding"],
      "Seoul-KR":            ["Iced Americano", "Soboro Ppang"],
      "Busan-KR":            ["Iced Americano", "Eomuk"],
      "Beijing-CN":          ["Pour Over", "Jianbing"],
      "Shanghai-CN":         ["Latte", "Shengjianbao"],
      "Shenzhen-CN":         ["Latte", "Cheung Fun"],
      "Chengdu-CN":          ["Pour Over", "Dan Hong Gao"],
      "Guangzhou-CN":        ["Yuanyang", "Char Siu Bao"],
      "Xi'an-CN":            ["Coffee", "Roujiamo"],
      "Hong Kong-HK":        ["Yuanyang", "Pineapple Bun"],
      "Taipei-TW":           ["Hand Drip", "Pineapple Cake"],
      "Macau-MO":            ["Galao", "Egg Tart"],
      "Singapore-SG":        ["Kopi", "Kaya Toast"],
      "Bangkok-TH":          ["Oliang", "Patongko"],
      "Phuket-TH":           ["Iced Coffee", "Roti"],
      "Chiang Mai-TH":       ["Hand Drip", "Khanom Krok"],
      "Hanoi-VN":            ["Ca phe sua nong", "Banh Mi"],
      "Ho Chi Minh City-VN": ["Ca phe sua da", "Banh Mi"],
      "Da Nang-VN":          ["Ca phe trung", "Banh Mi"],
      "Bali-ID":             ["Kopi Bali", "Bubur Injin"],
      "Jakarta-ID":          ["Kopi Tubruk", "Roti Bakar"],
      "Yogyakarta-ID":       ["Kopi Joss", "Gudeg"],
      "Surabaya-ID":         ["Kopi Tubruk", "Lontong Kupang"],
      "Manila-PH":           ["Barako Coffee", "Pandesal"],
      "Cebu-PH":             ["Sikwate", "Bibingka"],
      "Kuala Lumpur-MY":     ["Kopi", "Roti Bakar"],
      "Penang-MY":           ["White Coffee", "Apam Balik"],
      "Mumbai-IN":           ["Filter Coffee", "Vada Pav"],
      "Bangalore-IN":        ["Filter Coffee", "Masala Dosa"],
      "Chennai-IN":          ["Filter Coffee", "Idli"],
      "Hyderabad-IN":        ["Irani Chai", "Osmania Biscuit"],
      "Kolkata-IN":          ["Filter Coffee", "Singara"],
      "Pune-IN":             ["Filter Coffee", "Misal Pav"],
      "New Delhi-IN":        ["Masala Chai", "Aloo Paratha"],
      "Jaipur-IN":           ["Masala Chai", "Pyaaz Kachori"],
      "Goa-IN":              ["Filter Coffee", "Bebinca"],
      "Dhaka-BD":            ["Cha", "Singara"],
      "Colombo-LK":          ["Ceylon Coffee", "Pol Roti"],
      "Kathmandu-NP":        ["Sherpa Coffee", "Sel Roti"],
      "Lahore-PK":           ["Doodh Patti Chai", "Halwa Puri"],
      "Islamabad-PK":        ["Doodh Patti Chai", "Halwa Puri"],
      "Almaty-KZ":           ["Coffee", "Baursak"],
      "Tashkent-UZ":         ["Coffee", "Patyr"],
      "Dubai-AE":            ["Arabic Coffee", "Luqaimat"],
      "Abu Dhabi-AE":        ["Karak Chai", "Khameer Bread"],
      "Istanbul-TR":         ["Turk Kahvesi", "Simit"],

      // ── Africa ──────────────────────────────────────────
      "Marrakech-MA":        ["Cafe au Lait", "Msemen"],
      "Casablanca-MA":       ["Cafe au Lait", "Sfenj"],
      "Cairo-EG":            ["Turkish Coffee", "Fool & Tameya"],
      "Aswan-EG":            ["Hibiscus", "Aish Baladi"],
      "Tunis-TN":            ["Cafe Direct", "Baguette + Olive Oil"],
      "Algiers-DZ":          ["Cafe Noir", "Khobz Eddar"],
      "Cape Town-ZA":        ["Flat White", "Koeksister"],
      "Johannesburg-ZA":     ["Flat White", "Vetkoek"],
      "Nairobi-KE":          ["Kahawa", "Mandazi"],
      "Mombasa-KE":          ["Kahawa", "Mahamri"],
      "Kigali-RW":           ["Rwandan Bourbon", "Mandazi"],
      "Kampala-UG":          ["Ugandan Robusta", "Rolex"],
      "Addis Ababa-ET":      ["Buna", "Himbasha"],
      "Lusaka-ZM":           ["Coffee", "Vitumbuwa"],
      "Maputo-MZ":           ["Cafe", "Pao com Chourico"],
      "Windhoek-NA":         ["Filter Coffee", "Vetkoek"],
      "Zanzibar-TZ":         ["Spiced Coffee", "Mandazi"],

      // ── Europe ──────────────────────────────────────────
      "Lisbon-PT":           ["Bica", "Pastel de Nata"],
      "Porto-PT":            ["Cimbalino", "Bola de Berlim"],
      "Madeira-PT":          ["Galao", "Bolo de Mel"],
      "Madrid-ES":           ["Cafe con Leche", "Churros"],
      "Barcelona-ES":        ["Cortado", "Ensaimada"],
      "Granada-ES":          ["Cafe Solo", "Tostada"],
      "Bilbao-ES":           ["Cafe con Leche", "Talo"],
      "San Sebastian-ES":    ["Cafe con Leche", "Pintxo"],
      "Seville-ES":          ["Cafe con Leche", "Tostada con Tomate"],
      "Valencia-ES":         ["Cafe con Leche", "Pa amb Oli"],
      "Ibiza-ES":            ["Cortado", "Flao"],
      "Mallorca-ES":         ["Cafe con Leche", "Ensaimada"],
      "Paris-FR":            ["Cafe Creme", "Pain au Chocolat"],
      "Lyon-FR":             ["Cafe Noisette", "Brioche aux Pralines"],
      "Marseille-FR":        ["Cafe au Lait", "Navette"],
      "Bordeaux-FR":         ["Cafe Creme", "Canele"],
      "Nice-FR":             ["Cafe Creme", "Socca"],
      "Strasbourg-FR":       ["Cafe au Lait", "Kougelhopf"],
      "Toulouse-FR":         ["Cafe Noisette", "Chocolatine"],
      "Nantes-FR":           ["Cafe Creme", "Gateau Nantais"],
      "Rome-IT":             ["Espresso", "Cornetto"],
      "Milan-IT":            ["Espresso Macchiato", "Brioche"],
      "Florence-IT":         ["Espresso", "Schiacciata"],
      "Venice-IT":           ["Caffe", "Frittelle"],
      "Naples-IT":           ["Espresso", "Sfogliatella"],
      "Bologna-IT":          ["Espresso", "Crescentina"],
      "Verona-IT":           ["Espresso", "Pandoro"],
      "Genoa-IT":            ["Espresso", "Focaccia"],
      "Pisa-IT":             ["Espresso", "Cantucci"],
      "Amalfi-IT":           ["Espresso", "Sfogliatella"],
      "Palermo-IT":          ["Espresso", "Cannolo"],
      "Cagliari-IT":         ["Espresso", "Pardulas"],
      "Bari-IT":             ["Espresso", "Pasticciotto"],
      "Berlin-DE":           ["Filterkaffee", "Pretzel"],
      "Munich-DE":           ["Milchkaffee", "Brezel"],
      "Hamburg-DE":          ["Filterkaffee", "Franzbrotchen"],
      "Cologne-DE":          ["Cafe au Lait", "Mutzenmandeln"],
      "Frankfurt-DE":        ["Filterkaffee", "Bethmaennchen"],
      "Stuttgart-DE":        ["Filterkaffee", "Brezel"],
      "Duesseldorf-DE":      ["Filterkaffee", "Reibekuchen"],
      "Vienna-AT":           ["Wiener Melange", "Apfelstrudel"],
      "Salzburg-AT":         ["Wiener Melange", "Salzburger Nockerl"],
      "Innsbruck-AT":        ["Wiener Melange", "Apfelstrudel"],
      "Zurich-CH":           ["Cafe Creme", "Birchermuesli"],
      "Geneva-CH":           ["Cafe Creme", "Pain au Chocolat"],
      "Amsterdam-NL":        ["Koffie Verkeerd", "Stroopwafel"],
      "Rotterdam-NL":        ["Koffie Verkeerd", "Bossche Bol"],
      "Utrecht-NL":          ["Koffie Verkeerd", "Stroopwafel"],
      "Brussels-BE":         ["Cafe Creme", "Speculoos"],
      "Antwerp-BE":          ["Cafe au Lait", "Speculoos"],
      "Ghent-BE":            ["Cafe au Lait", "Mastellen"],
      "Prague-CZ":           ["Espresso", "Trdelnik"],
      "Brno-CZ":             ["Espresso", "Kolac"],
      "Budapest-HU":         ["Hosszu Kave", "Pogacsa"],
      "Warsaw-PL":           ["Kawa po Polsku", "Paczek"],
      "Krakow-PL":           ["Kawa po Turecku", "Obwarzanek"],
      "Wroclaw-PL":          ["Kawa po Polsku", "Paczek"],
      "Gdansk-PL":           ["Kawa po Polsku", "Sernik"],
      "Bratislava-SK":       ["Espresso", "Kolac"],
      "Ljubljana-SI":        ["Espresso", "Potica"],
      "Belgrade-RS":         ["Domaca Kafa", "Burek"],
      "Sofia-BG":            ["Tursko Kafe", "Banitsa"],
      "Bucharest-RO":        ["Cafea", "Covrigi"],
      "Vilnius-LT":          ["Cappuccino", "Sakotis"],
      "Riga-LV":             ["Filtered Coffee", "Sklandrausis"],
      "Tallinn-EE":          ["Espresso", "Kohuke"],
      "Athens-GR":           ["Greek Coffee", "Bougatsa"],
      "Mykonos-GR":          ["Frappe", "Loukoumades"],
      "Santorini-GR":        ["Frappe", "Melitinia"],
      "Dublin-IE":           ["Filter Coffee", "Soda Bread"],
      "Cork-IE":             ["Filter Coffee", "Brack"],
      "Galway-IE":           ["Filter Coffee", "Soda Bread"],
      "London-GB":           ["Flat White", "Bacon Sarnie"],
      "Manchester-GB":       ["Flat White", "Eccles Cake"],
      "Liverpool-GB":        ["Flat White", "Wet Nelly"],
      "Brighton-GB":         ["Flat White", "Croissant"],
      "Bath-GB":             ["Flat White", "Bath Bun"],
      "Glasgow-GB":          ["Flat White", "Tunnock's Tea Cake"],
      "Edinburgh-GB":        ["Flat White", "Empire Biscuit"],
      "York-GB":             ["Filter Coffee", "Yorkshire Curd Tart"],
      "Copenhagen-DK":       ["Filterkaffe", "Wienerbrod"],
      "Aarhus-DK":           ["Filterkaffe", "Smorrebrod"],
      "Stockholm-SE":        ["Bryggkaffe", "Kanelbulle"],
      "Gothenburg-SE":       ["Bryggkaffe", "Semla"],
      "Malmo-SE":            ["Bryggkaffe", "Spettekaka"],
      "Oslo-NO":             ["Filterkaffe", "Skolebolle"],
      "Bergen-NO":           ["Filterkaffe", "Lefse"],
      "Trondheim-NO":        ["Filterkaffe", "Krumkake"],
      "Stavanger-NO":        ["Filterkaffe", "Kringle"],
      "Helsinki-FI":         ["Suodatinkahvi", "Korvapuusti"],
      "Tampere-FI":          ["Suodatinkahvi", "Pulla"],
      "Reykjavik-IS":        ["Filterkaffi", "Snudur"],
      "Dubrovnik-HR":        ["Espresso", "Dubrovacka Rozata"],
      "Split-HR":            ["Espresso", "Soparnik"],

      // ── Americas ────────────────────────────────────────
      "New York-US":         ["Drip Coffee", "Bagel"],
      "Boston-US":           ["Drip Coffee", "Boston Cream Donut"],
      "Philadelphia-US":     ["Drip Coffee", "Soft Pretzel"],
      "Washington-US":       ["Drip Coffee", "Half Smoke"],
      "Atlanta-US":          ["Drip Coffee", "Biscuit"],
      "Nashville-US":        ["Drip Coffee", "Hot Chicken Biscuit"],
      "Charleston-US":       ["Drip Coffee", "Benne Wafer"],
      "Savannah-US":         ["Drip Coffee", "Pecan Pie"],
      "Chicago-US":          ["Drip Coffee", "Paczki"],
      "New Orleans-US":      ["Cafe au Lait (Chicory)", "Beignet"],
      "Austin-US":           ["Drip Coffee", "Breakfast Taco"],
      "Miami-US":            ["Cortadito", "Pastelito"],
      "Las Vegas-US":        ["Drip Coffee", "Bagel"],
      "Denver-US":           ["Drip Coffee", "Green Chile Burrito"],
      "Phoenix-US":          ["Drip Coffee", "Breakfast Burrito"],
      "Minneapolis-US":      ["Drip Coffee", "Lefse"],
      "Los Angeles-US":      ["Cold Brew", "Avocado Toast"],
      "San Francisco-US":    ["Cortado", "Sourdough Toast"],
      "Seattle-US":          ["Latte", "Croissant"],
      "Portland-US":         ["Pour Over", "Stumptown Donut"],
      "Honolulu-US":         ["Kona Coffee", "Malasada"],
      "Toronto-CA":          ["Filter Coffee", "Butter Tart"],
      "Montreal-CA":         ["Cafe au Lait", "Bagel"],
      "Vancouver-CA":        ["Flat White", "Nanaimo Bar"],
      "Calgary-CA":          ["Drip Coffee", "Pancakes"],
      "Edmonton-CA":         ["Drip Coffee", "Cinnamon Bun"],
      "Quebec City-CA":      ["Cafe au Lait", "Croissant"],
      "Halifax-CA":          ["Drip Coffee", "Donair"],
      "Mexico City-MX":      ["Cafe de Olla", "Concha"],
      "Guadalajara-MX":      ["Cafe de Olla", "Birote"],
      "Monterrey-MX":        ["Cafe de Olla", "Empanada"],
      "Puebla-MX":           ["Cafe de Olla", "Cemita"],
      "Merida-MX":           ["Cafe Yucateco", "Marquesita"],
      "Oaxaca-MX":           ["Cafe de Olla", "Pan de Yema"],
      "Cancun-MX":           ["Cafe Americano", "Concha"],
      "Tulum-MX":            ["Pour Over", "Marquesita"],
      "Antigua-GT":          ["Antigua Coffee", "Atol"],
      "San Salvador-SV":     ["Cafe Negro", "Pupusa"],
      "Managua-NI":          ["Cafe Negro", "Rosquilla"],
      "Tegucigalpa-HN":      ["Cafe Honduras", "Baleada"],
      "Belize City-BZ":      ["Drip Coffee", "Fry Jack"],
      "Havana-CU":           ["Cafe Cubano", "Pastelito"],
      "San Juan-PR":         ["Cafe Puertorriqueno", "Quesito"],
      "Kingston-JM":         ["Blue Mountain Coffee", "Hardo Bread"],
      "Nassau-BS":           ["Drip Coffee", "Conch Fritter"],
      "Bridgetown-BB":       ["Drip Coffee", "Bakes"],
      "Oranjestad-AW":       ["Drip Coffee", "Pan Bati"],
      "Willemstad-CW":       ["Cafe Negro", "Pastechi"],
      "Port of Spain-TT":    ["Coffee", "Doubles"],
      "Castries-LC":         ["Drip Coffee", "Bakes"],
      "Panama City-PA":      ["Cafe Geisha", "Hojaldre"],
      "San Jose-CR":         ["Tarrazu Coffee", "Gallo Pinto"],
      "Cartagena-CO":        ["Tinto", "Arepa de Huevo"],
      "Bogota-CO":           ["Tinto", "Almojabana"],
      "Medellin-CO":         ["Tinto", "Pandebono"],
      "Lima-PE":             ["Cafe Pasado", "Pan con Chicharron"],
      "Cusco-PE":            ["Cafe Pasado", "Pan Chuta"],
      "Quito-EC":            ["Cafe Pasillo", "Bolon de Verde"],
      "Guayaquil-EC":        ["Cafe Pasillo", "Bolon de Verde"],
      "La Paz-BO":           ["Cafe Pasado", "Salteña"],
      "Sucre-BO":            ["Cafe Pasado", "Mistela"],
      "Asuncion-PY":         ["Cafe Negro", "Chipa"],
      "Santiago-CL":         ["Cafe Helado", "Marraqueta"],
      "Buenos Aires-AR":     ["Cafe con Leche", "Medialuna"],
      "Mendoza-AR":          ["Cafe con Leche", "Pan Casero"],
      "Montevideo-UY":       ["Cafe con Leche", "Bizcocho"],
      "Punta del Este-UY":   ["Cafe Cortado", "Chivito"],
      "Rio de Janeiro-BR":   ["Cafezinho", "Pao de Queijo"],
      "Sao Paulo-BR":        ["Pingado", "Pao de Queijo"],
      "Salvador-BR":         ["Cafezinho", "Acaraje"],
      "Brasilia-BR":         ["Cafezinho", "Pao de Queijo"],
      "Recife-BR":           ["Cafezinho", "Tapioca"],
      "Curitiba-BR":         ["Cafezinho", "Quibebe"],
      "Belo Horizonte-BR":   ["Cafezinho", "Pao de Queijo"],
      "Florianopolis-BR":    ["Cafe com Leite", "Pastel"],
      "Fortaleza-BR":        ["Cafezinho", "Tapioca"],
      "Manaus-BR":           ["Cafe Forte", "Tucuma Sandwich"],

      // ── Oceania ─────────────────────────────────────────
      "Sydney-AU":           ["Flat White", "Vegemite Toast"],
      "Melbourne-AU":        ["Flat White", "Lamington"],
      "Brisbane-AU":         ["Flat White", "Anzac Biscuit"],
      "Perth-AU":            ["Flat White", "Vegemite Toast"],
      "Hobart-AU":           ["Flat White", "Apple Slice"],
      "Adelaide-AU":         ["Flat White", "Pie Floater"],
      "Cairns-AU":           ["Flat White", "Damper"],
      "Darwin-AU":           ["Flat White", "Damper"],
      "Auckland-NZ":         ["Flat White", "Mince Pie"],
      "Wellington-NZ":       ["Flat White", "Lolly Cake"],
      "Queenstown-NZ":       ["Flat White", "Bacon Butty"],
      "Christchurch-NZ":     ["Flat White", "Afghan Biscuit"],
      "Apia-WS":             ["Coffee", "Panikeke"],
    };;

const GREETINGS = {
      JP: "Ohayō", KR: "Annyeonghaseyo", CN: "Zǎo", HK: "Zǎo", TW: "Zǎo", MO: "Zǎo",
      TH: "Aroon sawat", VN: "Chào buổi sáng", ID: "Selamat pagi", PH: "Magandang umaga",
      MY: "Selamat pagi", SG: "Good morning",
      IN: "Suprabhat", PK: "Subah Bakhair", BD: "Suprabhat", LK: "Suba dawasak",
      NP: "Suprabhat", KZ: "Tan zhaqsy", UZ: "Hayrli tong",
      AE: "Sabah al-khair", TR: "Günaydın",
      GR: "Kalimera", EG: "Sabah al-khair", MA: "Sabah al-khair",
      KE: "Habari za asubuhi", TZ: "Habari za asubuhi", ZA: "Goeie môre",
      MU: "Bonjour", SC: "Bonzour",
      ES: "Buenos días", PT: "Bom dia",
      FR: "Bonjour", IT: "Buongiorno", DE: "Guten Morgen", AT: "Guten Morgen", CH: "Guten Morgen",
      NL: "Goedemorgen", BE: "Goedemorgen",
      CZ: "Dobré ráno", SK: "Dobré ráno", PL: "Dzień dobry", HU: "Jó reggelt",
      SE: "God morgon", NO: "God morgen", DK: "Godmorgen", FI: "Hyvää huomenta", IS: "Góðan daginn",
      IE: "Maidin mhaith", GB: "Morning",
      HR: "Dobro jutro", SI: "Dobro jutro", RS: "Dobro jutro", BG: "Dobro utro", RO: "Bună dimineața",
      LT: "Labas rytas", LV: "Labrīt", EE: "Tere hommikust",
      CV: "Bom dia",
      RW: "Mwaramutse", UG: "Wasuze otya", ET: "Endemen aderachehu",
      ZM: "Good morning", ZW: "Good morning", MZ: "Bom dia",
      MG: "Salama", NA: "Goeie môre", BW: "Good morning",
      CI: "Bonjour", SN: "Bonjour", TN: "Sabah al-khair", DZ: "Sabah al-khair",
      US: "Morning", CA: "Morning",
      MX: "Buenos días", GT: "Buenos días", SV: "Buenos días", NI: "Buenos días",
      HN: "Buenos días", BZ: "Good morning",
      CU: "Buenos días", PR: "Buenos días", JM: "Good morning", BS: "Good morning",
      BB: "Good morning", PA: "Buenos días", CR: "Buenos días",
      CO: "Buenos días", PE: "Buenos días", CL: "Buenos días", AR: "Buenos días",
      UY: "Buenos días", EC: "Buenos días", BO: "Buenos días", PY: "Buenos días",
      BR: "Bom dia",
      AW: "Bon dia", CW: "Bon dia", TT: "Good morning", LC: "Good morning",
      AU: "Morning", NZ: "Morning", WS: "Manuia", TO: "Mālō", VU: "Halo",
    };;


// ── HELPERS ─────────────────────────────────────────────────────────
function localHour(tz) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}
function isHappyHour(tz) {
  const h = localHour(tz);
  return h >= HAPPY_START && h < HAPPY_END;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weatherEmoji(code) {
  if (code === 0 || code === 1) return "☀";
  if (code === 2 || code === 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫";
  if (code >= 51 && code <= 67) return "🌦";
  if (code >= 71 && code <= 86) return "❄";
  if (code >= 95) return "⛈";
  return "⛅";
}

// Bake a smooth dark gradient into the bottom 65% of the photo so
// text reads cleanly on any image without relying on shadow alone.
function darkenImage(src) {
  const W = 360;
  const H = 170;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.respectScreenScale = true;
  ctx.opaque = true;

  // Cover-fit the source image into the canvas (object-fit: cover)
  const sw = src.size.width;
  const sh = src.size.height;
  const imgRatio = sw / sh;
  const ctxRatio = W / H;
  let drawRect;
  if (imgRatio > ctxRatio) {
    const drawW = H * imgRatio;
    drawRect = new Rect((W - drawW) / 2, 0, drawW, H);
  } else {
    const drawH = W / imgRatio;
    drawRect = new Rect(0, (H - drawH) / 2, W, drawH);
  }
  ctx.drawImageInRect(src, drawRect);

  // Bottom gradient: 0 alpha at 35% from top, ramping to 0.78 at bottom
  const steps = 30;
  const startY = H * 0.35;
  const stripH = (H - startY) / steps;
  for (let i = 0; i < steps; i++) {
    const alpha = (i / (steps - 1)) * 0.78;
    ctx.setFillColor(new Color("#000000", alpha));
    ctx.fillRect(new Rect(0, startY + i * stripH, W, stripH + 1));
  }
  // Subtle top scrim so the temp top-right reads on bright skies
  ctx.setFillColor(new Color("#000000", 0.32));
  ctx.fillRect(new Rect(0, 0, W, 36));

  return ctx.getImage();
}

// ── FETCH ───────────────────────────────────────────────────────────
async function fetchPayload() {
  const eligible = shuffle(CITIES.filter((c) => isHappyHour(c.tz)));
  for (const city of eligible) {
    try {
      const photoUrl = `${PROXY}?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&type=coffee`;
      const photoData = await new Request(photoUrl).loadJSON();
      if (!photoData || !photoData.url) continue;
      const rawImg = await new Request(photoData.url).loadImage();
      const img = darkenImage(rawImg);

      const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=${encodeURIComponent(city.tz)}`;
      const wx = await new Request(wxUrl).loadJSON();
      const temp = Math.round(wx.current.temperature_2m);
      const code = wx.current.weather_code;

      const drinks = COFFEES[`${city.name}-${city.cc}`] || [];
      return { city, img, temp, code, drinks };
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ── RENDER ──────────────────────────────────────────────────────────
function buildWidget(data) {
  const w = new ListWidget();
  w.url = SITE_URL;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);

  if (!data) {
    w.backgroundColor = new Color("#0a0a0a");
    w.setPadding(16, 18, 16, 18);
    const eyebrow = w.addText("· QUIET HOUR");
    eyebrow.font = Font.semiboldSystemFont(9);
    eyebrow.textColor = new Color("#ffffff", 0.55);
    w.addSpacer(8);
    const head = w.addText("It's evening everywhere.");
    head.font = new Font("Georgia-Italic", 18);
    head.textColor = new Color("#ffffff", 0.92);
    w.addSpacer(6);
    const sub = w.addText("Try happyhour  →");
    sub.font = Font.regularSystemFont(11);
    sub.textColor = new Color("#ffffff", 0.65);
    return w;
  }

  const { city, img, temp, code, drinks } = data;
  w.backgroundImage = img;
  w.setPadding(12, 16, 14, 16);

  // Top row: weather temp pinned right
  const topRow = w.addStack();
  topRow.layoutHorizontally();
  topRow.addSpacer();
  const tempText = topRow.addText(`${weatherEmoji(code)} ${temp}°`);
  tempText.font = Font.semiboldSystemFont(13);
  tempText.textColor = Color.white();
  tempText.shadowColor = new Color("#000000", 0.7);
  tempText.shadowRadius = 4;

  w.addSpacer();

  // Eyebrow: gold pulse-dot + label
  const eyebrowRow = w.addStack();
  eyebrowRow.layoutHorizontally();
  eyebrowRow.centerAlignContent();
  const dot = eyebrowRow.addText("·");
  dot.font = Font.heavySystemFont(13);
  dot.textColor = new Color(ACCENT);
  dot.shadowColor = new Color("#000000", 0.7);
  dot.shadowRadius = 4;
  eyebrowRow.addSpacer(7);
  const label = eyebrowRow.addText("IT'S COFFEE TIME IN");
  label.font = Font.semiboldSystemFont(9.5);
  label.textColor = new Color("#ffffff", 0.78);
  label.shadowColor = new Color("#000000", 0.7);
  label.shadowRadius = 4;

  w.addSpacer(2);

  // City: large serif
  const cityText = w.addText(city.name);
  cityText.font = new Font("Georgia", 26);
  cityText.textColor = Color.white();
  cityText.shadowColor = new Color("#000000", 0.7);
  cityText.shadowRadius = 5;
  cityText.lineLimit = 1;
  cityText.minimumScaleFactor = 0.5;

  // Country: smaller italic serif
  const countryText = w.addText(city.country);
  countryText.font = new Font("Georgia-Italic", 11);
  countryText.textColor = new Color("#ffffff", 0.62);
  countryText.shadowColor = new Color("#000000", 0.6);
  countryText.shadowRadius = 4;
  countryText.lineLimit = 1;
  countryText.minimumScaleFactor = 0.7;

  w.addSpacer(5);

  // Drinks: top two, middot-separated
  const drinkLine = drinks.slice(0, 2).join("  ·  ") || city.country;
  const drinkText = w.addText(drinkLine);
  drinkText.font = Font.regularSystemFont(11);
  drinkText.textColor = new Color("#ffffff", 0.82);
  drinkText.shadowColor = new Color("#000000", 0.6);
  drinkText.shadowRadius = 4;
  drinkText.lineLimit = 1;
  drinkText.minimumScaleFactor = 0.7;

  return w;
}

// ── RUN ─────────────────────────────────────────────────────────────
const data = await fetchPayload();
const widget = buildWidget(data);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
