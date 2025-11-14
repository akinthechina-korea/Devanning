# Devanning Application

디베이닝(컨테이너 하역) 관리 애플리케이션입니다.

## 배포 방법

### Vercel을 통한 빠른 배포

1. [Vercel](https://vercel.com)에 가입하고 로그인합니다.
2. "New Project"를 클릭합니다.
3. GitHub 저장소를 선택하고 `akinthechina-korea/Devanning`을 선택합니다.
4. 프로젝트 설정:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. "Deploy" 버튼을 클릭합니다.

### 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정해야 합니다:

- `DATABASE_URL`: 데이터베이스 연결 문자열
- `SESSION_SECRET`: 세션 암호화를 위한 시크릿 키
- 기타 필요한 환경 변수들

### 배포 완료 후

배포가 완료되면 Vercel이 자동으로 URL을 제공합니다. 예: `https://your-app.vercel.app`

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 기술 스택

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Express, Node.js
- **Database**: Drizzle ORM
- **Deployment**: Vercel

