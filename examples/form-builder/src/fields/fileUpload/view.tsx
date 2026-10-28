import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Input, Upload, type UploadFile } from 'antd';
import { useState } from 'react';
import type { FileMeta } from '../../domain/field';
import { ConfigItem, OptionalNumber } from '../configControls';
import type { ConfigPanelProps, FieldView } from '../viewTypes';
import { parseAccept, type FileUploadConfig } from './model';

function AcceptInput({ config, onChange, id }: ConfigPanelProps<FileUploadConfig> & { id?: string }) {
  // Keep the raw text locally so typing "pdf," isn't normalised mid-keystroke.
  const [text, setText] = useState(config.accept.join(', '));
  return (
    <Input
      id={id}
      value={text}
      placeholder=".pdf, .jpg, .png"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const accept = parseAccept(text);
        setText(accept.join(', '));
        onChange({ ...config, accept });
      }}
    />
  );
}

const toUploadFile = (f: FileMeta, i: number): UploadFile => ({
  uid: `${f.name}-${i}`,
  name: f.name,
  size: f.size,
  type: f.type,
  status: 'done',
});

export const fileUploadView: FieldView<FileUploadConfig, FileMeta[]> = {
  icon: <PaperClipOutlined />,
  ConfigPanel: (props) => (
    <>
      <ConfigItem label="Allowed file types" help="Comma-separated. Leave empty to allow any.">
        {/* keyed by field so switching selection remounts with that field's text */}
        <AcceptInput key={props.config.id} {...props} />
      </ConfigItem>
      <ConfigItem label="Max number of files">
        <OptionalNumber
          min={1}
          max={50}
          precision={0}
          value={props.config.maxFiles}
          onChange={(maxFiles) => props.onChange({ ...props.config, maxFiles: maxFiles ?? 1 })}
        />
      </ConfigItem>
    </>
  ),
  Input: ({ config, value, onChange, disabled }) => (
    <Upload
      multiple
      disabled={disabled}
      accept={config.accept.join(',') || undefined}
      // Files are never uploaded anywhere: only their metadata is kept.
      beforeUpload={() => false}
      fileList={(value ?? []).map(toUploadFile)}
      onChange={({ fileList }) => {
        const meta = fileList.map<FileMeta>((f) => ({
          name: f.name,
          size: f.size ?? f.originFileObj?.size ?? 0,
          type: f.type ?? f.originFileObj?.type ?? '',
        }));
        onChange(meta.length > 0 ? meta : undefined);
      }}
    >
      <Button icon={<UploadOutlined />} disabled={disabled}>
        Choose files
      </Button>
    </Upload>
  ),
};
