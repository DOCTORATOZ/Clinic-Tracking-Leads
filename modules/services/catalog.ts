export type ServiceCatalogItem = {
  id: string;
  name: string;
  defaultPlan: string;
  description: string;
  active: boolean;
};

/** Configurable clinic reference data; mock values only. */
export const serviceCatalog: ServiceCatalogItem[] = [
  {
    id: 'vascular-access-assessment',
    name: 'ประเมินหลอดเลือดฟอกไต',
    defaultPlan: 'Vascular access assessment v1',
    description: 'ติดตามการประเมินเส้นเลือดและความพร้อมก่อนหัตถการ',
    active: true,
  },
  {
    id: 'avf-creation',
    name: 'ผ่าตัดสร้างเส้นฟอกไต (AVF)',
    defaultPlan: 'AVF one-day surgery follow-up v1',
    description: 'ติดตามความพร้อมก่อนและหลังผ่าตัดแบบ one-day surgery',
    active: true,
  },
  {
    id: 'access-intervention',
    name: 'แก้ไขเส้นฟอกไตตีบหรืออุดตัน',
    defaultPlan: 'Access intervention follow-up v1',
    description: 'ติดตามอาการและนัดประเมินหลังหัตถการหลอดเลือด',
    active: true,
  },
  {
    id: 'dialysis-catheter',
    name: 'ใส่หรือดูแลสายฟอกไต',
    defaultPlan: 'Dialysis catheter follow-up v1',
    description: 'ติดตามการดูแลแผลและนัดประเมินตามแผนรักษา',
    active: true,
  },
  {
    id: 'vascular-one-day-surgery',
    name: 'ผ่าตัดหลอดเลือดแบบ One Day Surgery',
    defaultPlan: 'Vascular ODS follow-up v1',
    description: 'ประสานการเตรียมตัว การกลับบ้าน และการติดตามหลังผ่าตัด',
    active: true,
  },
];
