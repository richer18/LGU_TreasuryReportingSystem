import React, { useEffect, useState } from "react";
import axiosInstance from "../../../axiosinstance/axiosInstance";

function TotalRenew() {
  const [renewed, setRenewed] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch renewed applicants
  useEffect(() => {
    const fetchRenewed = async () => {
      try {
        const { data } = await axiosInstance.get("total-renew/list");
        setRenewed(data || []);
      } catch (error) {
        console.error("❌ Error fetching renewed applicants:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRenewed();
  }, []);

  // ✅ Format date (YYYY-MM-DD → Month DD, YYYY)
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-5 text-gray-800 flex items-center gap-2">
        🔁 <span>Total Renewed Applicants</span>
      </h2>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Loading data...</div>
      ) : renewed.length > 0 ? (
        <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-50 text-gray-700 uppercase tracking-wide text-xs">
              <tr>
                <th className="px-4 py-3 border">Date Registered</th>
                <th className="px-4 py-3 border">Name</th>
                <th className="px-4 py-3 border">MCH No</th>
                <th className="px-4 py-3 border">Franchise No</th>
                <th className="px-4 py-3 border">Renew From</th>
                <th className="px-4 py-3 border">Renew To</th>
              </tr>
            </thead>
            <tbody>
              {renewed.map((item, idx) => (
                <tr
                  key={idx}
                  className={`text-center transition-colors duration-150 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-blue-50`}
                >
                  <td className="border px-4 py-2">
                    {formatDate(item.PAYMENT_DATE)}
                  </td>
                  <td className="border px-4 py-2 font-medium text-gray-700">
                    {item.NAME}
                  </td>
                  <td className="border px-4 py-2">{item.MCH_NO}</td>
                  <td className="border px-4 py-2">{item.FRANCHISE_NO}</td>
                  <td className="border px-4 py-2">
                    {formatDate(item.RENEW_FROM)}
                  </td>
                  <td className="border px-4 py-2">
                    {formatDate(item.RENEW_TO)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-10">
          No renewed applicants found.
        </p>
      )}
    </div>
  );
}

export default TotalRenew;
