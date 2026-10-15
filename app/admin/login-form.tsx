const ERRORS: Record<string, string> = {
  mismatch: "Số điện thoại hoặc mã PIN không đúng.",
  empty: "Nhập đủ số điện thoại và mã PIN.",
  rate: "Bạn đã nhập sai quá nhiều lần. Thử lại sau ít phút.",
  config: "Thiếu biến môi trường ADMIN_PASSWORD trên server. Không thể tạo phiên đăng nhập.",
  unavailable: "Không kiểm tra được danh sách quản trị lúc này.",
};

const LEGACY_UNAVAILABLE = new Set(["sheet_config", "sheet_invalid", "sheet_forbidden", "sheet_shape", "sheet_down"]);

export function LoginForm({ errorCode }: { errorCode?: string }) {
  const message = errorCode ? ERRORS[errorCode] ?? (LEGACY_UNAVAILABLE.has(errorCode) ? ERRORS.unavailable : undefined) : undefined;
  return (
    <form action="/admin/login" method="post" className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <h1 className="text-xl font-bold text-slate-900">Đăng nhập quản trị</h1>
      <p className="text-sm text-slate-600 mt-2 mb-6">
        Mỗi quản trị viên dùng số điện thoại và mã PIN riêng. Mã PIN thí sinh không mở được trang này.
      </p>
      <label htmlFor="admin-phone" className="block text-xs font-bold text-slate-700 uppercase mb-2">
        Số điện thoại
      </label>
      <input
        id="admin-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoCapitalize="off"
        data-testid="admin-phone"
        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <label htmlFor="admin-pin" className="block text-xs font-bold text-slate-700 uppercase mb-2 mt-4">
        Mã PIN
      </label>
      <input
        id="admin-pin"
        name="pin"
        type="password"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-testid="admin-pin"
        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {message ? (
        <p role="alert" data-testid="login-error" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        data-testid="admin-login"
        className="mt-6 w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
      >
        Vào trang quản trị
      </button>
    </form>
  );
}
