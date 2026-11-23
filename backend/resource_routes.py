
# RESOURCE_ROUTES.PY - QUAN LY NGUON LUC HOC TAP

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from pathlib import Path
from threading import Lock
from datetime import datetime, timezone
from urllib.parse import urlparse
import json
import os
import uuid

from auth import get_current_user


router = APIRouter(
    prefix="/api/resources",
    tags=["Resources"]
)

BASE_DIR = Path(__file__).resolve().parent
RESOURCES_FILE = BASE_DIR / "data" / "study_resources.json"

file_lock = Lock()


# 1. Du lieu them tai lieu
class ResourceCreate(BaseModel):
    target_id: str = Field(min_length=1)
    resource_name: str = Field(min_length=2)
    resource_type: str = Field(min_length=1)
    resource_url: str = ""
    description: str = ""


# 2. Du lieu cap nhat tai lieu
class ResourceUpdate(BaseModel):
    resource_name: str = Field(min_length=2)
    resource_type: str = Field(min_length=1)
    resource_url: str = ""
    description: str = ""


# 3. Doc file JSON
def read_resources():
    if not RESOURCES_FILE.exists():
        RESOURCES_FILE.parent.mkdir(
            parents=True,
            exist_ok=True
        )
        RESOURCES_FILE.write_text(
            "[]",
            encoding="utf-8"
        )

    with open(RESOURCES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu nguon luc khong hop le"
        )

    return data


# 4. Luu file JSON
def save_resources(data):
    temp_file = RESOURCES_FILE.with_name(
        RESOURCES_FILE.name + ".tmp"
    )

    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2
        )

    os.replace(temp_file, RESOURCES_FILE)


# 5. Kiem tra duong dan tai lieu
def validate_url(url):
    url = url.strip()

    if not url:
        return ""

    parsed = urlparse(url)

    if (
        parsed.scheme not in ["http", "https"]
        or not parsed.netloc
    ):
        raise HTTPException(
            status_code=400,
            detail="Duong dan phai bat dau bang http:// hoac https://"
        )

    return url


# 6. Lay danh sach tai lieu
@router.get("")
def get_resources(
    target_id: str = None,
    user=Depends(get_current_user)
):
    resources = read_resources()

    # Chi lay tai lieu cua tai khoan dang nhap
    resources = [
        item for item in resources
        if item.get("user_id") == user["id"]
    ]

    if target_id:
        resources = [
            item for item in resources
            if item.get("target_id") == target_id
        ]

    return resources


# 7. Them tai lieu hoc tap
@router.post("", status_code=201)
def create_resource(
    data: ResourceCreate,
    user=Depends(get_current_user)
):
    resource_url = validate_url(data.resource_url)

    new_resource = {
        "resource_id": "RES" + uuid.uuid4().hex[:10].upper(),
        "user_id": user["id"],
        "target_id": data.target_id.strip(),
        "resource_name": data.resource_name.strip(),
        "resource_type": data.resource_type.strip(),
        "resource_url": resource_url,
        "description": data.description.strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    with file_lock:
        resources = read_resources()
        resources.append(new_resource)
        save_resources(resources)

    return {
        "message": "Them nguon luc thanh cong",
        "resource": new_resource
    }


# 8. Cap nhat tai lieu
@router.put("/{resource_id}")
def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    user=Depends(get_current_user)
):
    resource_url = validate_url(data.resource_url)

    with file_lock:
        resources = read_resources()

        for item in resources:
            if (
                item.get("resource_id") == resource_id
                and item.get("user_id") == user["id"]
            ):
                item["resource_name"] = data.resource_name.strip()
                item["resource_type"] = data.resource_type.strip()
                item["resource_url"] = resource_url
                item["description"] = data.description.strip()

                save_resources(resources)

                return {
                    "message": "Cap nhat nguon luc thanh cong",
                    "resource": item
                }

    raise HTTPException(
        status_code=404,
        detail="Khong tim thay nguon luc"
    )


# 9. Xoa tai lieu
@router.delete("/{resource_id}")
def delete_resource(
    resource_id: str,
    user=Depends(get_current_user)
):
    with file_lock:
        resources = read_resources()

        resource = next(
            (
                item for item in resources
                if (
                    item.get("resource_id") == resource_id
                    and item.get("user_id") == user["id"]
                )
            ),
            None
        )

        if resource is None:
            raise HTTPException(
                status_code=404,
                detail="Khong tim thay nguon luc"
            )

        resources.remove(resource)
        save_resources(resources)

    return {
        "message": "Xoa nguon luc thanh cong",
        "resource_id": resource_id
    }
