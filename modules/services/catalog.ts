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
    id: 'skin-program',
    name: 'โปรแกรมผิวหน้า',
    defaultPlan: 'Skin consultation v1',
    description: 'ประเมินและติดตามผลการดูแลผิว',
    active: true,
  },
  {
    id: 'laser-hair',
    name: 'เลเซอร์กำจัดขน',
    defaultPlan: 'Laser aftercare v1',
    description: 'ติดตามอาการและผลหลังทำเลเซอร์',
    active: true,
  },
  {
    id: 'botox',
    name: 'ฉีดโบท็อกซ์',
    defaultPlan: 'Injectable aftercare v1',
    description: 'ติดตามอาการหลังฉีดและการนัดติดตาม',
    active: true,
  },
  {
    id: 'filler',
    name: 'ฟิลเลอร์',
    defaultPlan: 'Injectable aftercare v1',
    description: 'ติดตามอาการหลังฉีดและการนัดติดตาม',
    active: true,
  },
  {
    id: 'hifu',
    name: 'ยกกระชับ HIFU',
    defaultPlan: 'HIFU follow-up v1',
    description: 'ติดตามผลการยกกระชับ',
    active: true,
  },
];
