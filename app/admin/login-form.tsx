const ERRORS: Record<string, string> = {
  password: "Mật khẩu quản trị không đúng.",
  empty: "Nhập mật khẩu quản trị.",
  rate: "Bạn đã nhập sai quá nhiều lần. Thử lại sau ít phút.",
  config: "Thiếu biến môi trường ADMIN_PASSWORD trên server. Không thể đăng nhập quản trị.",
};

export function LoginForm({ errorCode }: { errorCode?: string }) {
  const message = errorCode ? ERRORS[errorCode] : undefined;
  return (
    <form action="/admin/login" method="post" className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <h1 className="text-xl font-bold text-slate-900">Đăng nhập quản trị</h1>
      <p className="text-sm text-slate-600 mt-2 mb-6">
        Mật khẩu này chỉ dành cho người ra đề. Mã PIN thí sinh không mở được trang này.
      </p>
      <label htmlFor="admin-password" className="block text-xs font-bold text-slate-700 uppercase mb-2">
        Mật khẩu quản trị
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        data-testid="admin-password"
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
