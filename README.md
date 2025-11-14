# Devanning Application

디베이닝(컨테이너 하역) 관리 애플리케이션입니다.

## 배포 방법

### Render를 통한 배포 (권장)

#### 1단계: PostgreSQL 데이터베이스 생성

1. [Render](https://render.com)에 가입하고 로그인합니다.
2. "New +" → "PostgreSQL" 선택
3. 설정:
   - **Name**: `devanning-db` (또는 원하는 이름)
   - **Database**: `devanning_db`
   - **User**: `devanning_db_user`
   - **Region**: `Singapore`
   - **Plan**: `Free`
4. 생성 후 **External Database URL** 복사 (중요!)

#### 2단계: Web 서비스 생성

1. Render 대시보드 → "New +" → "Web Service"
2. GitHub 저장소 연결: `akinthechina-korea/Devanning`
3. 기본 설정:
   - **Name**: `devanning` (또는 원하는 이름)
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: (기본값, 비워둠)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

#### 3단계: 환경 변수 설정

Web 서비스 → "Environment" 탭에서 다음 환경 변수 추가:

- **Key**: `DATABASE_URL`
  **Value**: `postgresql://devanning_db_user:4s4NKHS8EPZZAuTzqBcoTG0ZtCPWu7YM@dpg-d4beurmr433s739b4bj0-a.singapore-postgres.render.com/devanning_db`
  (External Database URL 전체 복사)

- **Key**: `SESSION_SECRET`
  **Value**: (랜덤 문자열, 예: `your-secret-key-change-in-production`)

- **Key**: `NODE_ENV`
  **Value**: `production`

#### 4단계: 배포 확인

1. GitHub에 푸시하면 Render가 자동으로 배포를 시작합니다.
2. 배포 로그에서 다음 메시지 확인:
   - ✅ DATABASE_URL이 설정되어 있습니다.
   - ✅ PostgreSQL 데이터베이스 연결 성공
   - ✅ 모든 테이블이 생성되었습니다.
   - ✅ 초기 사용자 데이터가 추가됨
   - ✅ Keep-Alive 활성화

3. 기본 로그인 정보:
   - **Username**: `admin`
   - **Password**: `admin123`

#### 5단계: Keep-Alive 확인

Render 무료 플랜은 15분간 요청이 없으면 슬리프 모드로 전환됩니다.
이 앱은 자동으로 14분마다 Keep-Alive 핑을 보내 슬리프 모드를 방지합니다.

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

