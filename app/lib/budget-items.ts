// budget_items нь СӨХ-ийн зардал ба бусад орлого (зогсоол, түрээс г.м.) хоёуланг агуулна.
// Орлогыг type='income'-ээр, эсвэл `*_income` ангиллаар (жишээ нь parking_income) таньна —
// type баганын анхдагч утга нь 'expense' тул ангиллаар оруулсан орлого зардалд орчихгүйн тулд.
export function isIncomeItem(item: { type?: string | null; category?: string | null }): boolean {
  return item.type === 'income' || !!item.category?.endsWith('_income');
}
