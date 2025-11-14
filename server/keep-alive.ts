/**
 * Keep-Alive 스크립트
 * Render 무료 플랜의 15분 슬리프 모드 방지
 * 14분마다 서버에 자동 핑 요청
 */

export function startKeepAlive() {
  // 프로덕션 환경에서만 작동
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // RENDER_EXTERNAL_URL이 없으면 작동하지 않음
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (!externalUrl) {
    console.log("⚠️ RENDER_EXTERNAL_URL이 설정되지 않았습니다. Keep-Alive가 비활성화됩니다.");
    return;
  }

  console.log(`✅ Keep-Alive 활성화: ${externalUrl} (14분마다 핑)`);

  // 14분마다 핑 (840,000ms)
  const interval = 14 * 60 * 1000;

  const ping = async () => {
    try {
      const response = await fetch(externalUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Render-KeepAlive/1.0",
        },
      });
      
      if (response.ok) {
        console.log(`✅ Keep-Alive 핑 성공: ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Keep-Alive 핑 응답: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Keep-Alive 핑 실패:`, error);
    }
  };

  // 즉시 한 번 실행
  ping();

  // 주기적으로 실행
  setInterval(ping, interval);
}

