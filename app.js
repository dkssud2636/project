const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path'); 
const connectDB = require('./config/db.js');
const Store = require('./models/Store.js');
const User = require('./models/User.js');

// 1. 환경변수 로드 및 DB 연결 안전장치
dotenv.config();

// 🛠️ .env 파일 인식을 못 하더라도 코드가 구동되도록 하드코딩 백업 주소 주입
if (!process.env.DB_CONNECT) {
  process.env.DB_CONNECT = "mongodb+srv://admin:admin@cluster0.j86doqa.mongodb.net/project?retryWrites=true&w=majority";
}
connectDB();

const app = express();

// 🛠️ [Render 배포 필수] 프록시 서버(Render) 환경에서 세션 쿠키가 정상 전달되도록 설정
app.set('trust proxy', 1);

// 2. 미들웨어 설정
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 3. 세션 미들웨어 설정 (Render HTTPS 환경 최적화)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-matzip',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60, // 1시간 유지
    secure: true,          // 🛠️ HTTPS 환경이므로 true로 변경 (세션 풀림 방지)
    sameSite: 'none'       // 🛠️ 크로스 도메인 간 쿠키 공유 허용
  }
}));

// 4. 라우터 설정

// 처음 접속 시 세션 여부에 따라 로그인 폼 유도
app.get('/', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// [API] 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, password, name } = req.body;
    if (!userId || !password || !name) return res.status(400).json({ error: '모든 필드를 입력해주세요.' });

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

    req.session.user = { 
      id: user._id, 
      userId: user.userId, 
      name: user.name
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

// [POST] 맛집 데이터 추가 API 
app.post('/api/stores', async (req, res) => {
  try {
    // 🛠️ 일반 유저도 본인 계정으로 로그인만 하면 맛집 등록이 가능하도록 isAdmin 조건 제거
    if (!req.session.user) {
      return res.status(401).json({ error: '🚫 맛집 등록 권한이 없습니다. 로그인이 필요합니다.' });
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

// [GET] 내 주변 맛집 검색 API
app.get('/api/stores/nearby', async (req, res) => {
  try {
    const { lng, lat } = req.query;
    if (!lng || !lat) return res.status(400).json({ error: '경도와 위도가 필요합니다.' });

    const stores = await Store.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: 2000 // 2km 반경
        }
      }
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. 서버 가동
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 안정적으로 달리는 중...🏃‍♂️`);
});
