import AdminAnalytics from '../admin/AdminAnalytics';

const ManagerAnalytics = () => {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-100">Revenue & Trends Analytics</h2>
        <p className="text-xs text-slate-400">
          Visual metrics tracking ticket reservations, earnings over time, and high-demand route volume.
        </p>
      </div>
      <AdminAnalytics />
    </div>
  );
};

export default ManagerAnalytics;
