/**
 * Import actual inventory data from Excel export (Optimized batch version)
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

interface InventoryRow {
  sr: string; date: string; party: string; hsn: string; mfg: string
  name: string; pkg: string; batch: string; exp: string
  mrp: number; qty: number; free: number; rate: number
  amount: number; disc: number; gst: number
}

function detectForm(pkg: string): string {
  const p = pkg.toUpperCase()
  if (p.includes('INJ') || p.includes('VIAL') || p.includes('AMP')) return 'injection'
  if (p.includes('SYR') || p.includes('SUSP')) return 'syrup'
  if ((p.includes('CAP') || p.includes('CPS')) && !p.includes('CAPS')) return 'capsule'
  if (p.includes('CREAM') || p.includes('OINT') || p.includes('GEL')) return 'cream'
  if (p.includes('DROP') || p.includes('EYE')) return 'drops'
  if (p.includes('INH')) return 'inhaler'
  if (p.includes('POW') || p.includes('GRAN')) return 'powder'
  if (p.includes('LOTION') || p.includes('SHAM') || p.includes('OIL')) return 'cream'
  if (p.includes('SAFETY') || p.includes('MASK') || p.includes('PAD') || p.includes('BAND') || p.includes('DIAPER')) return 'piece'
  return 'tablet'
}

function detectUnit(pkg: string): string {
  const p = pkg.toUpperCase()
  if (p.includes('INJ') || p.includes('VIAL') || p.includes('AMP')) return 'vial'
  if (p.includes('BOT') || p.includes('ML') || p.includes('SYR') || p.includes('SUSP') || p.includes('OIL') || p.includes('SHAM') || p.includes('LOTION') || p.includes('LIQ')) return 'bottle'
  if (p.includes('CREAM') || p.includes('OINT') || p.includes('GEL') || p.includes('SPRAY')) return 'tube'
  if (p.includes('POW') || p.includes('GRAN') || p.includes('MASK') || p.includes('PAD') || p.includes('BAND') || p.includes('DIAPER') || p.includes('KADHA')) return 'pack'
  return 'strip'
}

function detectStripQty(pkg: string): number {
  const p = pkg.trim().toUpperCase()
  const multiMatch = p.match(/^1\s*\*\s*(\d+)/)
  if (multiMatch) return parseInt(multiMatch[1])
  const stripMatch = p.match(/^(\d+)\s*S/)
  if (stripMatch) return parseInt(stripMatch[1])
  const tabMatch = p.match(/^(\d+)\s*T/)
  if (tabMatch) return parseInt(tabMatch[1])
  const nsMatch = p.match(/^(\d+)\s*S$/)
  if (nsMatch) return parseInt(nsMatch[1])
  const numMatch = p.match(/^(\d+)$/)
  if (numMatch) { const n = parseInt(numMatch[1]); return n <= 200 ? n : 1 }
  return 1
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'N/A' || dateStr === 'NA') return null
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return new Date(dateStr)
  } catch { return null }
}

async function clearAllData() {
  console.log('🗑️  Clearing all existing data...')
  const tables = [
    'stockAdjustment', 'payment', 'delivery', 'salesInvoiceItem', 'salesInvoice',
    'prescription', 'rateContractItem', 'rateContract', 'purchaseOrderItem',
    'purchaseOrder', 'claim', 'commission', 'dayBook', 'auditLog', 'notification',
    'mrpHistory', 'unitConversion', 'scheme', 'medicineBatch', 'medicine',
    'expense', 'staff', 'customer', 'supplier', 'counter', 'manufacturer', 'category'
  ]
  for (const table of tables) {
    try { await (db as any)[table].deleteMany() } catch {}
  }
  console.log('✅ All data cleared')
}

async function main() {
  const jsonPath = path.join(process.cwd(), 'upload', 'inventory_data.json')
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as InventoryRow[]
  console.log(`📊 Loaded ${rawData.length} inventory rows from Excel`)

  await clearAllData()

  // Create defaults
  const category = await db.category.create({ data: { name: 'General', description: 'General pharmaceutical products' } })
  await db.counter.create({ data: { name: 'Main Counter', code: 'POS-1' } })
  console.log(`📁 Category & counter created`)

  // Create manufacturers
  const uniqueMfgs = [...new Set(rawData.map(r => r.mfg).filter(Boolean))].sort()
  console.log(`🏭 Creating ${uniqueMfgs.length} manufacturers...`)
  for (let i = 0; i < uniqueMfgs.length; i += 100) {
    await db.manufacturer.createMany({ data: uniqueMfgs.slice(i, i + 100).map(name => ({ name })), skipDuplicates: true })
  }
  const allMfgs = await db.manufacturer.findMany({ select: { id: true, name: true } })
  const mfgMap = new Map(allMfgs.map(m => [m.name, m.id]))

  // Create suppliers
  const uniqueSuppliers = [...new Set(rawData.map(r => r.party).filter(Boolean))].sort()
  console.log(`🚚 Creating ${uniqueSuppliers.length} suppliers...`)
  await db.supplier.createMany({ data: uniqueSuppliers.map(name => ({ name })), skipDuplicates: true })
  const allSuppliers = await db.supplier.findMany({ select: { id: true, name: true } })
  const supplierMap = new Map(allSuppliers.map(s => [s.name, s.id]))

  // Group by (name, mfg)
  const productMap = new Map<string, InventoryRow[]>()
  for (const row of rawData) {
    const key = `${row.name}|||${row.mfg}`
    if (!productMap.has(key)) productMap.set(key, [])
    productMap.get(key)!.push(row)
  }

  console.log(`💊 Creating ${productMap.size} unique medicines...`)

  // First pass: create all medicines with createMany, tracking index-to-key mapping
  const entries = [...productMap.entries()]
  const validEntries: { key: string; rows: InventoryRow[] }[] = []
  const medicineKeyToIndex = new Map<string, number>() // key -> index in validEntries
  
  // Prepare medicine data (filter out those with missing manufacturer)
  const medicineDataList: any[] = []
  for (const [key, rows] of entries) {
    const first = rows[0]
    const mfgId = mfgMap.get(first.mfg)
    if (!mfgId) {
      console.warn(`⚠️  Skipping "${first.name}" - manufacturer "${first.mfg}" not found`)
      continue
    }
    const idx = validEntries.length
    validEntries.push({ key, rows })
    medicineKeyToIndex.set(key, idx)
    medicineDataList.push({
      name: first.name,
      categoryId: category.id,
      manufacturerId: mfgId,
      hsnCode: first.hsn || null,
      gstRate: first.gst,
      form: detectForm(first.pkg),
      unit: detectUnit(first.pkg),
      stripQty: detectStripQty(first.pkg),
      minStockLevel: 10,
      maxStockLevel: 500,
      reorderPoint: 20,
      reorderQty: 50,
      isActive: true,
    })
  }

  // Batch insert medicines (100 at a time)
  console.log(`   Inserting ${medicineDataList.length} medicines in batches...`)
  for (let i = 0; i < medicineDataList.length; i += 100) {
    await db.medicine.createMany({
      data: medicineDataList.slice(i, i + 100),
      skipDuplicates: true,
    })
    console.log(`   Medicines batch ${Math.floor(i/100)+1}/${Math.ceil(medicineDataList.length/100)}`)
  }

  // Now fetch all medicines to get their IDs
  // Since medicine names can repeat, we need to match by name + manufacturer
  const allMedicines = await db.medicine.findMany({
    select: { id: true, name: true, manufacturerId: true }
  })
  
  // Build reverse map: manufacturerId -> name
  const mfgIdToName = new Map(allMfgs.map(m => [m.id, m.name]))
  
  // Build map: "name|||mfgName" -> medicineId
  const medKeyToId = new Map<string, string>()
  for (const med of allMedicines) {
    const mfgName = mfgIdToName.get(med.manufacturerId) || ''
    const key = `${med.name}|||${mfgName}`
    if (!medKeyToId.has(key)) medKeyToId.set(key, med.id)
  }

  // Create all batches
  let batchCount = 0
  let totalStock = 0
  let totalValue = 0
  const allBatchData: any[] = []

  for (const { key, rows } of validEntries) {
    const medicineId = medKeyToId.get(key)
    if (!medicineId) continue

    for (const row of rows) {
      const expiryDate = parseDate(row.exp)
      if (!expiryDate) continue

      const sellingPrice = parseFloat((row.mrp * 0.95).toFixed(2))
      const wholesalePrice = parseFloat((row.mrp * 0.88).toFixed(2))
      const supplierId = supplierMap.get(row.party) || null
      const batchNo = (row.batch && row.batch !== 'N/A' && row.batch !== 'NA' && row.batch.trim() !== '')
        ? row.batch
        : `BN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`

      allBatchData.push({
        medicineId,
        batchNo,
        expiryDate,
        manufacturingDate: parseDate(row.date),
        costPrice: row.rate,
        mrp: row.mrp,
        sellingPrice,
        wholesalePrice,
        openingStock: row.qty,
        currentStock: row.qty,
        freeStock: row.free,
        minDiscount: row.disc,
        supplierId,
        isActive: true,
      })

      batchCount++
      totalStock += row.qty + row.free
      totalValue += row.amount
    }
  }

  // Insert batches (100 at a time)
  console.log(`📦 Inserting ${batchCount} batches...`)
  for (let i = 0; i < allBatchData.length; i += 100) {
    await db.medicineBatch.createMany({
      data: allBatchData.slice(i, i + 100),
      skipDuplicates: true,
    })
    if ((i + 100) % 200 === 0 || i + 100 >= allBatchData.length) {
      console.log(`   Batches ${Math.min(i + 100, allBatchData.length)}/${allBatchData.length}`)
    }
  }

  // Create walk-in customer + admin
  await db.customer.create({ data: { id: 'cust-walkin', name: 'Walk-in Customer', type: 'retail', loyaltyPts: 0 } })
  const bcrypt = await import('bcryptjs')
  const hp = await bcrypt.default.hash('admin123', 10)
  await db.staff.create({ data: { name: 'Admin', email: 'admin@pharmacy.com', role: 'admin', password: hp, isActive: true } })

  console.log('\n═══════════════════════════════════════════════')
  console.log('✅ IMPORT COMPLETE!')
  console.log('═══════════════════════════════════════════════')
  console.log(`📁 Categories:     1`)
  console.log(`🖥️  Counters:       1`)
  console.log(`🏭 Manufacturers:  ${mfgMap.size}`)
  console.log(`🚚 Suppliers:      ${supplierMap.size}`)
  console.log(`💊 Medicines:      ${validEntries.length}`)
  console.log(`📦 Batches:        ${batchCount}`)
  console.log(`📊 Total Stock:    ${totalStock.toLocaleString()} units`)
  console.log(`💰 Total Value:    ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  console.log(`👤 Staff:          1 (admin)`)
  console.log('═══════════════════════════════════════════════')
}

main()
  .catch((e) => { console.error('❌ Import failed:', e); process.exit(1) })
  .finally(() => db.$disconnect())
