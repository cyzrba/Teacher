<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { formatFileSize, localId } from '@/utils/format'
import type { UploadedDoc } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: UploadedDoc[]
    hint?: string
    tip?: string
    /** 单文件大小上限（MB） */
    limitMb?: number
    /** 允许的扩展名，留空表示不限制 */
    accept?: string[]
  }>(),
  { hint: '', tip: '文件将上传至 MinIO / S3（接口已预留）', limitMb: 50, accept: () => [] },
)

const emit = defineEmits<{ 'update:modelValue': [UploadedDoc[]] }>()

/** 供 el-upload 的类型选择器使用 */
const acceptAttr = (): string => props.accept.map((ext) => `.${ext}`).join(',')

function onChange(file: { name?: string; size?: number; raw?: File }): void {
  if (!file.name) return

  // 大小与类型校验：不符合的文件不入列表，并给出明确原因
  const size = file.size ?? 0
  if (size > props.limitMb * 1024 * 1024) {
    ElMessage.error(
      `「${file.name}」体积 ${formatFileSize(size)}，超过 ${props.limitMb}MB 上限，请压缩后再上传`,
    )
    return
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (props.accept.length > 0 && !props.accept.includes(ext)) {
    ElMessage.error(`「${file.name}」类型不支持，仅接受 ${props.accept.join(' / ')}`)
    return
  }
  if (props.modelValue.some((item) => item.name === file.name)) {
    ElMessage.warning(`「${file.name}」已在列表中，无需重复上传`)
    return
  }

  const entry: UploadedDoc = {
    id: localId('doc'),
    name: file.name,
    size: file.size ?? 0,
    type: file.raw?.type ?? file.name.split('.').pop() ?? 'file',
    uploadedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
  emit('update:modelValue', [...props.modelValue, entry])
}

function remove(id: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item.id !== id),
  )
}
</script>

<template>
  <div class="upload">
    <el-upload
      drag
      multiple
      :accept="acceptAttr()"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="onChange"
    >
      <p class="upload__text">把文件拖到这里，或<em>点击选择文件</em></p>
      <p class="upload__hint">
        {{ hint || tip }}；单个文件 ≤ {{ limitMb }}MB
        <template v-if="accept.length">；仅支持 {{ accept.join(' / ') }}</template>
      </p>
    </el-upload>

    <ul v-if="modelValue.length" class="filelist">
      <li v-for="file in modelValue" :key="file.id" class="file">
        <span class="file__name">{{ file.name }}</span>
        <span class="file__meta num">{{ formatFileSize(file.size) }}</span>
        <button class="file__remove" type="button" title="移除" @click="remove(file.id)">✕</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload__text {
  color: var(--ink-2);
  font-size: 13px;
}

.upload__text em {
  color: var(--brand-600);
  font-style: normal;
  font-weight: 600;
}

.upload__hint {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 11.5px;
}

.filelist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 600;
}

.file__meta {
  color: var(--ink-3);
  font-size: 11.5px;
}

.file__remove {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
}

.file__remove:hover {
  background: var(--danger-bg);
  color: var(--danger);
}
</style>
