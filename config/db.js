const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.DB_CONNECT) {
      throw new Error(".env 파일에 DB_CONNECT가 정의되지 않았거나 로드되지 않았습니다.");
    }

    const conn = await mongoose.connect(process.env.DB_CONNECT);
    console.log(`MongoDB 연결 성공: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 연결 실패: ${error.message}`);
  }
};

module.exports = connectDB;
