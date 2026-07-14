import React, { useEffect, useState } from "react";
import axiosInstance from "../../../axiosinstance/axiosInstance";
import { Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";

function TotalRevenue() {
  const [revenues, setRevenues] = useState([]);

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const { data } = await axiosInstance.get("bplo/total-revenue/yearly");
        setRevenues(data || []);
      } catch (error) {
        console.error("❌ Error fetching revenue data:", error);
      }
    };
    fetchRevenue();
  }, []);

  return (
    <Card sx={{ p: 2, mt: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          💰 Total Revenue by Year
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>Year</b></TableCell>
              <TableCell align="right"><b>Total Revenue (₱)</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {revenues.map((r) => (
              <TableRow key={r.year}>
                <TableCell>{r.year}</TableCell>
                <TableCell align="right">₱{Number(r.total).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default TotalRevenue;
