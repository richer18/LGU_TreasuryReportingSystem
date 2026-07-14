import React, { useEffect, useState } from "react";
import axiosInstance from "../../../axiosinstance/axiosInstance";

function TotalRegistered() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const fetchRegistered = async () => {
      try {
        const { data } = await axiosInstance.get("total-registered/list");
        setRecords(data || []);
      } catch (error) {
        console.error("❌ Error fetching registered data:", error);
      }
    };
    fetchRegistered();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📋 Total Registered
        </h2>
        <span className="text-sm text-gray-600">
          Total: <strong>{records.length}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm rounded-lg overflow-hidden">
          <thead className="bg-blue-100 text-gray-800">
            <tr>
              <th className="border px-3 py-2 text-left">📅 Date Registered</th>
              <th className="border px-3 py-2 text-left">👤 Name</th>
              <th className="border px-3 py-2 text-center">🆔 MCH No</th>
              <th className="border px-3 py-2 text-center">🚗 Franchise No</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-blue-50 transition ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="border px-3 py-2">
                    {formatDate(item.DATE_REGISTERED)}
                  </td>
                  <td className="border px-3 py-2 font-medium text-gray-800">
                    {item.NAME}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {item.MCH_NO || "—"}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {item.FRANCHISE_NO || "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="4"
                  className="text-center py-4 text-gray-500 italic"
                >
                  No registered records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TotalRegistered;
