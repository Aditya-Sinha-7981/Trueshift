import { Link } from "react-router-dom"

export default function PendingVerification() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-900/40 bg-amber-950/20 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-200 text-xl">
          ⏳
        </div>
        <h1 className="mt-4 text-lg font-semibold text-amber-100">Pending verification</h1>
        <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
          Your account is pending admin verification. You will receive an email once activated.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700"
        >
          Return to sign in
        </Link>
      </div>
    </div>
  )
}
