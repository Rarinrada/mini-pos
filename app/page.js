"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });

  // แถวที่กำลังแก้ไข (เก็บ id + ข้อมูลที่แก้)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ดึงรายการสินค้าทั้งหมด เรียงตามวันที่สร้างล่าสุดก่อน
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // จัดการค่าฟอร์มเพิ่มสินค้า
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลงตาราง products
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      setError('กรุณากรอก SKU และชื่อสินค้า');
      return;
    }

    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
      setError('');
      fetchProducts();
    }
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmDelete = confirm('ยืนยันการลบสินค้านี้?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setError(error.message);
    } else {
      fetchProducts();
    }
  };

  // เริ่มแก้ไขแถว: คัดลอกข้อมูลปัจจุบันมาใส่ editForm
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขสินค้า
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price) || 0,
        stock: parseInt(editForm.stock, 10) || 0,
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      cancelEdit();
      fetchProducts();
    }
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {error && (
        <div className="card" style={{ color: '#dc2626', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้าใหม่</h2>
        <form
          onSubmit={handleAddProduct}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
        >
          <input
            name="sku"
            placeholder="SKU"
            value={form.sku}
            onChange={handleFormChange}
            style={{ width: '110px' }}
          />
          <input
            name="name"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={handleFormChange}
            style={{ width: '160px' }}
          />
          <input
            name="price"
            type="number"
            step="0.01"
            placeholder="ราคา"
            value={form.price}
            onChange={handleFormChange}
            style={{ width: '100px' }}
          />
          <input
            name="stock"
            type="number"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={handleFormChange}
            style={{ width: '90px' }}
          />
          <input
            name="unit"
            placeholder="หน่วย"
            value={form.unit}
            onChange={handleFormChange}
            style={{ width: '80px' }}
          />
          <button type="submit">เพิ่มสินค้า</button>
        </form>
      </div>

      {/* ตารางรายการสินค้า */}
      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>ชื่อสินค้า</th>
                <th>ราคา</th>
                <th>คงเหลือ</th>
                <th>หน่วย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  {editingId === p.id ? (
                    // โหมดแก้ไข inline
                    <>
                      <td>
                        <input name="sku" value={editForm.sku} onChange={handleEditChange} style={{ width: '90px' }} />
                      </td>
                      <td>
                        <input name="name" value={editForm.name} onChange={handleEditChange} style={{ width: '140px' }} />
                      </td>
                      <td>
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          value={editForm.price}
                          onChange={handleEditChange}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          name="stock"
                          type="number"
                          value={editForm.stock}
                          onChange={handleEditChange}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td>
                        <input name="unit" value={editForm.unit} onChange={handleEditChange} style={{ width: '60px' }} />
                      </td>
                      <td style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleSaveEdit(p.id)}>บันทึก</button>
                        <button onClick={cancelEdit} style={{ backgroundColor: '#6b7280' }}>
                          ยกเลิก
                        </button>
                      </td>
                    </>
                  ) : (
                    // โหมดแสดงผลปกติ
                    <>
                      <td>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.unit}</td>
                      <td style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => startEdit(p)}>แก้ไข</button>
                        <button onClick={() => handleDelete(p.id)} style={{ backgroundColor: '#dc2626' }}>
                          ลบ
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6}>ยังไม่มีสินค้าในระบบ</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
