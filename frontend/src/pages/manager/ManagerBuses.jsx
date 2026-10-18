import AdminBuses from '../admin/AdminBuses';

const ManagerBuses = () => {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-100">Fleet & Route Management</h2>
        <p className="text-xs text-slate-400">
          Configure bus fleets, assign routes, update timings, adjust fares, and monitor seat occupancy.
        </p>
      </div>
      <AdminBuses />
    </div>
  );
};

export default ManagerBuses;
