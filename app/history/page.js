"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ดึงประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  const fetchSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setSales(data);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // คำนวณยอดขายรวมทั้งหมดจาก total_price ของทุกรายการ
  const grandTotal = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // แปลง sold_at (ISO string) ให้อ่านง่ายขึ้น
  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {error && (
        <div className="card" style={{ color: '#dc2626', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      {/* สรุปยอดขายรวม */}
      <div className="card" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
        ยอดขายรวมทั้งหมด: {grandTotal.toFixed(2)} บาท
      </div>

      {/* ตารางประวัติการขาย */}
      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>วันเวลาที่ขาย</th>
                <th>ชื่อสินค้า</th>
                <th>จำนวน</th>
                <th>ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{formatDateTime(s.sold_at)}</td>
                  <td>{s.product_name}</td>
                  <td>{s.quantity}</td>
                  <td>{Number(s.total_price).toFixed(2)}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4}>ยังไม่มีประวัติการขาย</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
