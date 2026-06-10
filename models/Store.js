const mongoose = require('mongoose');

// 맛집 데이터 구조(Schema) 정의
const storeSchema = new mongoose.Schema({
  // 1. 맛집 이름 (필수)
  name: { 
    type: String, 
    required: true,
    trim: true // 앞뒤 공백 제거
  },
  
  // 2. 카테고리 (한식, 일식, 중식, 양식, 카페 등)
  category: { 
    type: String,
    default: '기타'
  },
  
  // 3. 지번 또는 도로명 주소 (필수)
  address: { 
    type: String, 
    required: true 
  },
  
  // 4. 위치 기반 공간 데이터 (GeoJSON 형식 - 필수)
  location: {
    type: { 
      type: String, 
      enum: ['Point'], // 오직 고정된 점(Point) 형태만 허용
      default: 'Point' 
    },
    coordinates: { 
      type: [Number], // [경도(longitude), 위도(latitude)] 순서의 숫자 배열
      required: true 
    }
  },
  
  // 5. ⭐ 상세 정보 링크 URL 필드 (블로그, 네이버 지도 링크 등)
  url: { 
    type: String,
    trim: true
  }
}, {
  // 데이터가 생성/수정된 시간을 자동으로 몽고DB에 기록해주는 옵션 (선택사항)
  timestamps: true 
});

// 🔥 [중요] 내 주변 맛집을 계산하는 공간 쿼리($near)를 쓰기 위해 위치 데이터에 인덱스를 부여합니다.
storeSchema.index({ location: '2dsphere' });

// 외부 파일(app.js 등)에서 이 모델을 불러와 쓸 수 있도록 내보내기
module.exports = mongoose.model('Store', storeSchema);