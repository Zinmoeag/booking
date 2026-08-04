type PrismaDelegate = {
  findUnique: (args: any) => Promise<any>;
  findFirst: (args: any) => Promise<any>;
  findMany: (args: any) => Promise<any[]>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
};

export abstract class BaseRepository<TDelegate extends PrismaDelegate> {
  constructor(protected readonly delegate: TDelegate) {}

  findUnique(args: Parameters<TDelegate['findUnique']>[0]) {
    return this.delegate.findUnique(args);
  }

  findFirst(args: Parameters<TDelegate['findFirst']>[0]) {
    return this.delegate.findFirst(args);
  }

  findMany(args: Parameters<TDelegate['findMany']>[0]) {
    return this.delegate.findMany(args);
  }

  create(args: Parameters<TDelegate['create']>[0]) {
    return this.delegate.create(args);
  }

  update(args: Parameters<TDelegate['update']>[0]) {
    return this.delegate.update(args);
  }

  delete(args: Parameters<TDelegate['delete']>[0]) {
    return this.delegate.delete(args);
  }

  count(args: Parameters<TDelegate['count']>[0]) {
    return this.delegate.count(args);
  }
}
