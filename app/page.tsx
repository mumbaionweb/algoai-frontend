import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            AlgoAI Trading Platform
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Algorithmic Trading with Backtrader & Zerodha
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
