declare module 'jsmediatags' {
  interface PictureTag {
    data: number[];
    format: string;
    description?: string;
  }

  interface Tags {
    picture?: PictureTag;
  }

  interface ReadResult {
    tags: Tags;
  }

  interface ReadHandlers {
    onSuccess: (result: ReadResult) => void;
    onError: (error: unknown) => void;
  }

  const jsmediatags: {
    read: (source: Blob | File | string, handlers: ReadHandlers) => void;
  };

  export default jsmediatags;
}
