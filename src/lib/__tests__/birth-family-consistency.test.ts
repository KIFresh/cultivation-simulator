import { describe, it, expect } from 'vitest';
import { validateBirthConsistency, type BirthFamilyMember } from '@/lib/narrative';

describe('validateBirthConsistency', () => {
  const defaultFamily: BirthFamilyMember[] = [
    { relation: '父亲', name: '李建国', age: 38, alive: true, occupation: '教师', livingTogether: true },
    { relation: '母亲', name: '王秀兰', age: 36, alive: true, occupation: '家庭主妇', livingTogether: true },
  ];

  it('正常家庭：正文含所有姓名关系，无错误', () => {
    const narrative = '寒冬腊月，李家的产房里传来一声啼哭。父亲李建国焦急地在门外踱步，母亲王秀兰躺在床上，虚弱地看着 newborn。接生婆笑着说："是个男孩！"李建国给孩子取名李逍遥。';
    const errors = validateBirthConsistency(narrative, '李逍遥', defaultFamily);
    expect(errors).toEqual([]);
  });

  it('suggestedName 未出现在正文中时报告错误', () => {
    const narrative = '产房里传来啼哭声。父亲李建国焦急踱步，母亲王秀兰躺在床上。接生婆说是个男孩。';
    const errors = validateBirthConsistency(narrative, '张无名', defaultFamily);
    expect(errors).toContainEqual(expect.stringContaining('张无名'));
    expect(errors).toContainEqual(expect.stringContaining('未出现在叙事正文'));
  });

  it('家庭成员姓名未出现在正文中时报告错误', () => {
    const narrative = '产房里传来啼哭声。父亲张大山焦急地等候。给孩子取名张小宝。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '张小宝', family);
    expect(errors).toContainEqual(expect.stringContaining('李建国'));
  });

  it('身份冲突：正文称某人母亲，JSON 称姐姐', () => {
    const narrative = '产房里，母亲王秀兰抱着刚出生的婴儿。父亲李建国在一旁欣慰地笑着。给孩子取名李雨。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '姐姐', name: '王秀兰', age: 36, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李雨', family);
    // 正文说"母亲王秀兰"，但 JSON 为 "姐姐王秀兰"→ 关系词不匹配
    expect(errors).toContainEqual(expect.stringContaining('母亲'));
  });

  it('重复关系提示错误', () => {
    const narrative = '父亲李建国和母亲王秀兰守在产房外。祖父李铁柱坐在一旁。给孩子取名李小明。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '父亲', name: '李铁柱', age: 68, alive: true },  // 两个父亲
      { relation: '母亲', name: '王秀兰', age: 36, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李小明', family);
    expect(errors).toContainEqual(expect.stringContaining('重复'));
  });

  it('非法年龄提示错误', () => {
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: -5, alive: true },
    ];
    const narrative = '父亲李建国焦急等待。给孩子取名李华。';
    const errors = validateBirthConsistency(narrative, '李华', family);
    expect(errors).toContainEqual(expect.stringContaining('年龄不合理'));
  });

  it('空关系提示错误', () => {
    const family: BirthFamilyMember[] = [
      { relation: '', name: '李建国', age: 38, alive: true } as any,
    ];
    const narrative = '李建国焦急等待。给孩子取名李华。';
    const errors = validateBirthConsistency(narrative, '李华', family);
    expect(errors).toContainEqual(expect.stringContaining('关系为空'));
  });

  it('空姓名提示错误', () => {
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '', age: 38, alive: true } as any,
    ];
    const narrative = '父亲焦急等待。给孩子取名李华。';
    const errors = validateBirthConsistency(narrative, '李华', family);
    expect(errors).toContainEqual(expect.stringContaining('姓名为空'));
  });

  it('已故成员正常通过', () => {
    const narrative = '祖母张翠花虽已过世，但家人仍念着她的好。父亲李建国和母亲王秀兰喜迎新生儿。给孩子取名李思。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '母亲', name: '王秀兰', age: 36, alive: true },
      { relation: '祖母', name: '张翠花', age: 68, alive: false },
    ];
    const errors = validateBirthConsistency(narrative, '李思', family);
    expect(errors).toEqual([]);
  });

  it('单亲家庭正常通过', () => {
    const narrative = '母亲王秀兰独自一人在产房里咬牙坚持。她给孩子取名李自强。';
    const family: BirthFamilyMember[] = [
      { relation: '母亲', name: '王秀兰', age: 30, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李自强', family);
    expect(errors).toEqual([]);
  });

  it('祖辈同住正常通过', () => {
    const narrative = '爷爷李铁柱和奶奶张翠花在客厅里喜笑颜开。父亲李建国和母亲王秀兰在卧室照顾婴儿。给孩子取名李明珠。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '母亲', name: '王秀兰', age: 36, alive: true },
      { relation: '祖父', name: '李铁柱', age: 68, alive: true },
      { relation: '祖母', name: '张翠花', age: 66, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李明珠', family);
    expect(errors).toEqual([]);
  });

  it('兄弟姐妹正常通过', () => {
    const narrative = '姐姐李小娟趴在床边好奇地看着弟弟。父亲李建国笑着说这是你妹妹。母亲王秀兰轻声哄着婴儿。给孩子取名李小雨。';
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '母亲', name: '王秀兰', age: 36, alive: true },
      { relation: '姐姐', name: '李小娟', age: 6, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李小雨', family);
    expect(errors).toEqual([]);
  });

  it('空叙事返回空数组但无错误', () => {
    const errors = validateBirthConsistency('', '李逍遥', defaultFamily);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('正文提及关系词但 family 无对应成员', () => {
    const narrative = '母亲王秀兰抱着婴儿，爷爷李铁柱在一旁笑。父亲李建国给孩子取名李龙。';
    // family 缺爷爷
    const family: BirthFamilyMember[] = [
      { relation: '父亲', name: '李建国', age: 38, alive: true },
      { relation: '母亲', name: '王秀兰', age: 36, alive: true },
    ];
    const errors = validateBirthConsistency(narrative, '李龙', family);
    expect(errors).toHaveLength(1); // 只有"爷爷"关系词不匹配
  });
});
