/**
 * Next.js가 서버 인스턴스를 띄울 때 요청을 받기 전에 딱 한 번 실행하는 훅.
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 *
 * 여기서 지식창고/사용자 저장소를 미리 초기화해두는 이유: 그렇게 안 하면 각 스토어는 첫 요청이
 * 들어올 때 지연 초기화(mkdir + 빈 파일 생성)되는데, Railway 볼륨을 처음 빈 상태로 마운트한
 * 배포에서 권한/경로 문제가 있으면 그 문제가 "Ready 로그 이후 첫 요청에서 크래시"라는 애매한
 * 형태로만 나타난다. 부팅 시점에 미리 시도하면 문제가 있을 때 배포 로그에 곧바로, 명확하게
 * 나타난다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[uncaughtException]", error);
  });

  // 아래 동적 import 자체가 실패할 수 있다(예: GEMINI_API_KEY/SESSION_SECRET이 없으면
  // "@/config/env"가 모듈 평가 시점에 바로 예외를 던지고, db/index → env로 이어지는 이
  // import 체인이 그 예외를 그대로 전파한다). 이 실패를 try 밖에 두면 Next.js가
  // "Failed to prepare server"로 처리하면서 그 이후 모든 요청이 계속 실패하게 되므로,
  // import 문 자체까지 통째로 감싼다.
  try {
    const { initAllStores } = await import("./db/index");
    const { initUsersStore } = await import("./auth/userStore");
    initAllStores();
    initUsersStore();
  } catch (error) {
    console.error(
      "[instrumentation] 초기화 실패 - GEMINI_API_KEY/SESSION_SECRET 환경변수가 설정되어 있는지, " +
        "data/ 경로 쓰기 권한이나 볼륨 마운트 설정이 올바른지 확인하세요.",
      error,
    );
  }
}
