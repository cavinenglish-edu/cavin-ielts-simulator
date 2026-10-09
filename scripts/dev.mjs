import { spawn } from "child_process";
import http from "http";

// Khởi động Next.js dev server
const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
});

let opened = false;

// Tự động kiểm tra khi nào localhost:3000 sẵn sàng thì mở trình duyệt
function checkAndOpenBrowser() {
  if (opened) return;

  const req = http.get("http://localhost:3000", (res) => {
    if (!opened) {
      opened = true;
      console.log("\n🚀 Server sẵn sàng! Đang tự động mở trình duyệt...");
      spawn("cmd", ["/c", "start", "http://localhost:3000"], {
        detached: true,
        stdio: "ignore",
      });
    }
  });

  req.on("error", () => {
    // Chưa sẵn sàng, thử lại sau 600ms
    setTimeout(checkAndOpenBrowser, 600);
  });
}

// Bắt đầu thăm dò sau 1 giây
setTimeout(checkAndOpenBrowser, 1000);

// Xử lý thoát tiến trình mượt mà
process.on("SIGINT", () => {
  next.kill("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  next.kill("SIGTERM");
  process.exit(0);
});
