const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // 안전장치: DB_CONNECT가 잘 로드되었는지 확인
    if (!process.env.DB_CONNECT) {
      throw new Error(".env 파일에 DB_CONNECT가 정의되지 않았거나 로드되지 않았습니다.");
    }

    // process.env.DB_CONNECT 로 변경!
    const conn = await mongoose.connect(process.env.DB_CONNECT);
    console.log(`MongoDB 연결 성공: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 연결 실패: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;