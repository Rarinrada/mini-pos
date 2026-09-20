"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

// === Telegram config (อ่านจาก Environment Variables) ===
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// === ฟังก์ชันส่งข้อความแจ้งเตือนเข้า Telegram ===
// ทำงานแบบ async/try-catch เพื่อไม่ให้ error จาก Telegram กระทบระบบขายหลัก
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram config ไม่ครบ (BOT_TOKEN หรือ CHAT_ID)');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    // ไม่ throw ต่อ เพื่อไม่ให้กระทบการทำงานของระบบขาย
    console.error('ส่งข้อความ Telegram ไม่สำเร็จ:', err);
  }
}

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ดึงรายการสินค้าทั้งหมดมาไว้ใน dropdown
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

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

  // หาข้อมูลสินค้าที่กำลังเลือกอยู่ (ใช้คำนวณยอดรวม)
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  // กดปุ่ม "ขาย"
  const handleSell = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError('กรุณาเลือกสินค้า');
      return;
    }
    if (qtyNumber <= 0) {
      setError('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }
    // ตรวจสอบ stock ว่าเพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setError(`สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`);
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setError(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ในตาราง products ให้ลดลง
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    // === 3) แจ้งเตือน Telegram: มีรายการขายใหม่ ===
    // ไม่ await แบบบล็อก flow หลัก แต่มี try-catch อยู่ใน sendTelegramMessage แล้ว
    // จึงเรียก await ได้อย่างปลอดภัย ไม่ทำให้ขั้นตอนขายสำเร็จขัดข้อง
    const now = new Date();
    const timeText = now.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newOrderMessage =
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${selectedProduct.name}\n` +
      `- จำนวน: ${qtyNumber} ชิ้น\n` +
      `- ราคารวม: ${totalPrice.toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${timeText}`;

    await sendTelegramMessage(newOrderMessage);

    // === 4) แจ้งเตือน Telegram: สต๊อกใกล้หมด (ถ้า newStock <= 5) ===
    const LOW_STOCK_THRESHOLD = 5;
    if (newStock <= LOW_STOCK_THRESHOLD) {
      const lowStockMessage =
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
        `- สินค้า: ${selectedProduct.name}\n` +
        `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
        `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

      await sendTelegramMessage(lowStockMessage);
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดรายการสินค้าใหม่ (stock ล่าสุด)
    setSuccess(`ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ`);
    resetForm();
    await fetchProducts();
    setSubmitting(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {error && (
        <div className="card" style={{ color: '#dc2626', background: '#fef2f2' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="card" style={{ color: '#15803d', background: '#f0fdf4' }}>
          {success}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' }}>
            <div>
              <label htmlFor="product">สินค้า</label>
              <br />
              <select
                id="product"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {Number(p.price).toFixed(2)} บาท (คงเหลือ {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quantity">จำนวน</label>
              <br />
              <input
                id="quantity"
                type="number"
                min="1"
                placeholder="จำนวนที่ขาย"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              ยอดรวม: {totalPrice.toFixed(2)} บาท
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ขาย'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

