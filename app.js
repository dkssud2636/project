const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path'); // 🛠️ 클라우드 배포 시 경로 에러 방지를 위해 필수 포함
const connectDB = require('./config/db.js');
const Store = require('./models/Store.js');
const User = require('./models/User.js');

// 1. 환경변수 로드 및 DB 연결
dotenv.config();
connectDB();

const app = express();

// 2. 미들웨어 설정
app.use(express.json());

// 🛠️ [Render 배포 최적화] express.static이 루트(/) 경로를 가로채지 못하도록 index 서빙을 차단합니다.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 3. 세션 미들웨어 설정 (로그인 유지용 및 보안 강화)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-matzip',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60, // 1시간 유지
    secure: false // 배포 초기 단계나 HTTP 환경에서의 호환성을 위해 false 세팅 (HTTPS 강제 시 true 변경 가능)
  }
}));


// 4. 라우터 설정

// 🛠️ [루트 라우트 복구 및 경로 최적화] 처음 접속 시 세션 여부에 따라 로그인 폼 유도
app.get('/', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// [API] 회원가입 (일반 유저용)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, password, name } = req.body;
    if (!userId || !password || !name) return res.status(400).json({ error: '모든 필드를 입력해주세요.' });

    // 시스템 보호를 위해 admin 아이디 생성 방지
    if (userId.toLowerCase() === 'admin') {
      return res.status(400).json({ error: '사용할 수 없는 아이디입니다.' });
    }

    const existingUser = await User.findOne({ userId });
    if (existingUser) return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ userId, password: hashedPassword, name });
    await newUser.save();

    res.status(201).json({ message: '회원가입 성공!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [API] 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

    // 세션 구조화 및 어드민 식별 플래그 주입
    req.session.user = { 
      id: user._id, 
      userId: user.userId, 
      name: user.name,
      isAdmin: user.userId === 'admin'
    };
    res.json({ message: '로그인 성공!', user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [API] 로그아웃
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: '로그아웃 실패' });
    res.clearCookie('connect.sid');
    res.json({ message: '로그아웃 성공' });
  });
});

// [API] 현재 로그인 상태 확인
app.get('/api/auth/status', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// [POST] 맛집 데이터 추가 API 🔒 (어드민 보안 가드 가동)
app.post('/api/stores', async (req, res) => {
  try {
    // 세션이 없거나 어드민 권한이 거짓(false)인 경우 등록 거부
    if (!req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: '🚫 맛집 등록 권한이 없습니다. 관리자만 가능합니다.' });
    }

    const { name, category, address, longitude, latitude } = req.body;
    if (!name || !address || !longitude || !latitude) return res.status(400).json({ error: '필수 정보 누락' });

    const newStore = new Store({
      name, category, address,
      location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] }
    });
    const savedStore = await newStore.save();
    res.status(201).json(savedStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [GET] 내 주변(반경 2km) 맛집 검색 API
app.get('/api/stores/nearby', async (req, res) => {
  try {
    const { lng, lat } = req.query;
    if (!lng || !lat) return res.status(400).json({ error: '경도와 위도가 필요합니다.' });

    const stores = await Store.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: 2000 // 2000m = 2km 반경
        }
      }
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. 서버 가동
// 🛠️ [Render 배포 핵심] Render가 무작위로 할당하는 포트 프로세스를 완벽 수용합니다.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 안정적으로 달리는 중...🏃‍♂️`);
});